const { forwardTo } = require('prisma-binding');
const { hasPermission } = require("../utils");

const Query = {
  // async items(parent, args, ctx, info) {
  //   const items = await ctx.db.query.items();
  //   return items;
  // },
  items: forwardTo('db'),

  item: forwardTo('db'),

  itemsConnection: forwardTo('db'),

  me(parent, args, ctx, info) {
    // check if there is a current user id
    if (!ctx.request.userId) {
      return null;
    }
    return ctx.db.query.user({
      where: { id: ctx.request.userId }
    }, info);
  },

  users(parent, args, ctx, info) {
    // check if they are logged in
    if (!ctx.request.userId)
      throw new Error("You must be logged in!");

    // check if the user has the permissions to query all the users
    hasPermission(ctx.request.user, ['ADMIN', 'PERMISSIONUPDATE']);

    // if they do, query all the users
    return ctx.db.query.users({}, info);
  },

  async order(parent, args, ctx, info) {
    // make sure they are logged in
    if (!ctx.request.userId)
      throw new Error("You aren't logged in.");

    // query the current order
    const order = await ctx.db.query.order({
      where: { id: args.id },
    }, info);

    // check if they ahve the permissions to see this order
    const ownsOrder = order.user.id === ctx.request.userId;
    const hasPermissionToSeeOrder = ctx.request.user.permissions.includes('ADMIN');
    if (!ownsOrder || !hasPermissionToSeeOrder) {
      throw new Error("You can't see this.");
    }

    // Return the order
    return order;
  },

  async orders(parent, args, ctx, info) {
    // make sure they are logged in
    const { userId } = ctx.request;
    if (!userId)
      throw new Error("You aren't logged in.");

    // Return the order
    return ctx.db.query.orders({
      where: {
        user: { id: userId }
      }
    }, info);
  }
};

module.exports = Query;
