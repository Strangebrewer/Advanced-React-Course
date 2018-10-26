// These files ("resolvers") seem to be the same or similar to a controller.
const bcrypt = require('bcryptjs');
const jwt = require("jsonwebtoken");


const Mutations = {
  async createItem(parent, args, ctx, info) {
    // TODO: Check if they are logged in
    const item = await ctx.db.mutation.createItem({
      data: {
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
    const item = await ctx.db.query.item({ where }, `{ id, title }`);
    // check if they own that item or have the permissions
    // TODO
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
  }
};

module.exports = Mutations;
