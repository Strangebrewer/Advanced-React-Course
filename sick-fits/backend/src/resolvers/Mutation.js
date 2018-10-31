// These files ("resolvers") seem to be the same or similar to a controller.
const bcrypt = require('bcryptjs');
const jwt = require("jsonwebtoken");
const { randomBytes } = require("crypto");
const { promisify } = require("util");
const { transport, makeANiceEmail } = require("../mail");
const { hasPermission } = require("../utils");
const stripe = require('../stripe');

const Mutations = {
  async createItem(parent, args, ctx, info) {
    if (!ctx.request.userId)
      throw new Error("You must be logged in to do that.");

    // TODO: Check if they are logged in
    const item = await ctx.db.mutation.createItem({
      data: {
        // this is how to create a relationship between the item and the user
        user: {
          connect: {
            id: ctx.request.userId
          }
        },
        ...args
      }
    }, info);
    return item;
  },

  updateItem(parent, args, ctx, info) {
    // first take a copy of the updates
    const updates = { ...args };
    // remove the ID from the updates - ID is not something you update, so you remove it from the args before updating
    delete updates.id
    // run the update method
    return ctx.db.mutation.updateItem({
      data: updates,
      where: {
        id: args.id
      }
    })
  },

  async deleteItem(parent, args, ctx, info) {
    const where = { id: args.id };
    // find the item
    const item = await ctx.db.query.item({ where }, `{ id title user { id } }`);

    // check if they own that item or have the permissions
    const ownsItem = item.user.id === ctx.request.userId;
    const hasPermissions = ctx.request.user.permissions.some(
      permission => ['ADMIN', 'ITEMDELETE'].includes(permission)
    );
    if (!ownsItem && !hasPermissions)
      throw new Error("You don't have permission to do that.")

    // delete it!
    return ctx.db.mutation.deleteItem({ where }, info);
  },

  async signup(parent, args, ctx, info) {
    // lowercase the email to make signins easier later.
    args.email = args.email.toLowerCase();
    // has the password
    const password = await bcrypt.hash(args.password, 10);
    // create the user in the db
    const user = await ctx.db.mutation.createUser({
      data: {
        ...args,
        password,
        permissions: { set: ['USER'] }
      }
    }, info);
    // create JWT token for the user
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
    // set jwt as a cookie on the response
    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, // this makes it a one-year cookie
    });
    // and then return the user to the browser
    return user;
  },

  // you can destructure email and password from the args since those are the only args you will need
  async signin(parent, { email, password }, ctx, info) {
    // check if there is a user with that email
    const user = await ctx.db.query.user({ where: { email } });
    if (!user) throw new Error(`No such user found for email ${email}`);

    // check if their pw is correct
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new Error("Invalid password.");

    // generate the JWT token
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);

    // set the cookie with the token
    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, // this makes it a one-year cookie
    });

    // return the user
    return user;
  },

  signout(parent, args, ctx, info) {
    ctx.response.clearCookie("token");
    return { message: "Goodbye!" };
  },

  async requestReset(parent, args, ctx, info) {
    // check if this is a real user
    const user = await ctx.db.query.user({ where: { email: args.email } });
    if (!user) throw new Error(`No such user found for email ${args.email}`);
    // set a reset token and expiry on that user
    const randomBytesPromisified = promisify(randomBytes);
    const resetToken = (await randomBytesPromisified(20)).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now
    const res = await ctx.db.mutation.updateUser({
      where: { email: args.email },
      data: { resetToken, resetTokenExpiry }
    });

    // email them that reset token
    const mailRes = await transport.sendMail({
      from: 'derp@bob.com',
      to: user.email,
      subject: 'Your password reset token',
      html: makeANiceEmail(`Your password reset token is here!
        \n\n
        <a href="${process.env
          .FRONTEND_URL}/reset?resetToken=${resetToken}
          ">Click here to Reset</a>`),
    });

    // return the message
    return { message: "Narf!" };
  },

  async resetPassword(parent, args, ctx, info) {
    // check if pws match
    if (args.password !== args.confirmPassword)
      throw new Error("Your passwords do not match.");

    // check if it's a legit reset token & check if it's expired
    // in the const below, this is querying all users (vs. just user, which will only allow a search on the unique fields, which in this case are id and email), which returns an array. Destructuring it as '[user]' returns the first item in the response. Thus, the search only returns the first one to meet the 'where' criteria
    const [user] = await ctx.db.query.users({
      where: {
        resetToken: args.resetToken,
        resetTokenExpiry_gte: Date.now() - 3600000
      }
    });
    if (!user) throw new Error("This token is either invalid or expired.");

    // hash their new pw
    const password = await bcrypt.hash(args.password, 10);

    // save the new pw to the user & remove old reset token fields
    const updatedUser = await ctx.db.mutation.updateUser({
      where: { email: user.email },
      data: {
        password,
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    // Generate JWT
    const token = jwt.sign({ userId: updatedUser.id }, process.env.APP_SECRET);

    // set the JWT cookie
    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, // this makes it a one-year cookie
    });

    // return new user
    return updatedUser;
  },

  async updatePermissions(parent, args, ctx, info) {
    // check if logged in
    if (!ctx.request.userId)
      throw new Error("You must be logged in!");

    // query the current user
    const currentUser = await ctx.db.query.user({
      where: { id: ctx.request.userId }
    }, info);

    // check if they have permissions to update permissions
    hasPermission(currentUser, ['ADMIN', 'PERMISSIONUPDATE']);

    // update the permissions
    return ctx.db.mutation.updateUser({
      data: { permissions: { set: args.permissions } },
      where: { id: args.userId },
    }, info)
  },

  async addToCart(parent, args, ctx, info) {
    // make sure they are signed in
    const { userId } = ctx.request;
    if (!userId) throw new Error("You must be signed in to do that.");

    // query user's current cart
    const [existingCartItem] = await ctx.db.query.cartItems({
      where: {
        user: { id: userId },
        item: { id: args.id }
      },
    });

    // check if that item is already in their cart and increment by 1 if it is
    if (existingCartItem) {
      return ctx.db.mutation.updateCartItem({
        where: { id: existingCartItem.id },
        data: { quantity: existingCartItem.quantity + 1 }
      }, info);
    }

    // if it is not, create a fresh cartItem for that user
    return ctx.db.mutation.createCartItem({
      data: {
        user: { connect: { id: userId } },
        item: { connect: { id: args.id } }
      }
    }, info);
  },

  async removeFromCart(parent, args, ctx, info) {
    // find the cart item
    const cartItem = await ctx.db.query.cartItem({
      where: {
        id: args.id,
      },
    }, `{ id, user { id } }`);
    // make sure we found an item
    if (!cartItem) throw new Error("No cart item found.");
    // make sure they own the cart item
    if (cartItem.user.id !== ctx.request.userId) {
      throw new Error("Cheatin huh?");
    }
    // delete that cart item
    return ctx.db.mutation.deleteCartItem({
      where: { id: args.id }
    }, info);
  },

  async createOrder(parent, args, ctx, info) {
    // query the current user and make sure they're signed in
    const { userId } = ctx.request;
    if (!userId)
      throw new Error("You must be signed in to complete this order.");
    const user = await ctx.db.query.user(
      { where: { id: userId } },
      `{
        id
        name
        email
        cart {
          id
          quantity
          item { title price id description image largeImage }
        }
      }`
    );

    // recalc the total for the price
    // you recalc to avoid savvy users from changing the price that gets sent from the frontend
    const amount = user.cart.reduce(
      (tally, cartItem) => tally + cartItem.item.price * cartItem.quantity, 0
    );
    console.log(`Going to charge for a total of ${amount}`);

    // create the Stripe charge (turn token into money)
    const charge = await stripe.charges.create({
      amount,
      currency: 'USD',
      source: args.token,
    });

    // Convert the cartItems to orderItems
    const orderItems = user.cart.map(cartItem => {
      const orderItem = {
        ...cartItem.item,
        quantity: cartItem.quantity,
        user: { connect: { id: userId } },
      };
      delete orderItem.id;
      return orderItem;
    })

    // Create the order
    const order = await ctx.db.mutation.createOrder({
      data: {
        total: charge.amount,
        charge: charge.id,
        items: { create: orderItems },
        user: { connect: { id: userId } },
      }
    });

    // Clean up - clear the user's cart, delete cartItems
    const cartItemIds = user.cart.map(cartItem => cartItem.id);
    await ctx.db.mutation.deleteManyCartItems({
      where: {
        id_in: cartItemIds,
      }
    });

    // return the Order to the client
    return order;
  }

};

module.exports = Mutations;
