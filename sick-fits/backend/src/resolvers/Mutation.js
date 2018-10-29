// These files ("resolvers") seem to be the same or similar to a controller.
const bcrypt = require('bcryptjs');
const jwt = require("jsonwebtoken");
const { randomBytes } = require("crypto");
const { promisify } = require("util");
const { transport, makeANiceEmail } = require("../mail");
const { hasPermission } = require("../utils");

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
  }

};

module.exports = Mutations;
