import React, { Component } from 'react';
import { Query } from "react-apollo";
import { format } from "date-fns";
import gql from "graphql-tag";
import formatMoney from "../lib/formatMoney";
import Error from "./ErrorMessage";
import OrderStyles from "./styles/OrderStyles";

const ALL_ORDERS_QUERY = gql`
  query ALL_ORDERS_QUERY {
    orders {
      id
      charge
      total
      createdAt
      user {
        id
      }
      items {
        id
        title
        description
        price
        image
        quantity
      }
    }
  }
`;

class Orders extends Component {
  render() {
    return (
      <Query query={ALL_ORDERS_QUERY}>
        {({ data, error, loading }) => {
          if (error) return <Error error={error} />;
          if (loading) return <p>Loading...</p>;
          console.log(data);
          const orders = data.orders;
          return (
            <OrderStyles>
              {orders.map(order => (
                <>
                  <p>
                    <span>Order ID:</span>
                    <span>{order.id}</span>
                  </p>
                  <p>
                    <span>Charge:</span>
                    <span>{order.charge}</span>
                  </p>
                  <p>
                    <span>Date:</span>
                    <span>{format(order.createdAt, 'MMMM d, YYYY h:mm a')}</span>
                  </p>
                  <p>
                    <span>Order Total:</span>
                    <span>{formatMoney(order.total)}</span>
                  </p>
                  <p>
                    <span>Item Count:</span>
                    <span>{order.items.length}</span>
                  </p>
                  <div className="items">
                    {order.items.map(item => (
                      <div className="order-item" key={item.id}>
                        <img src={item.image} alt={item.title} />
                        <div className="item-details">
                          <h2>{item.title}</h2>
                          <p>Qty: {item.quantity}</p>
                          <p>Each: {formatMoney(item.price)}</p>
                          <p>Subtotal: {formatMoney(item.price * item.quantity)}</p>
                          <p>{item.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ))}
            </OrderStyles>
          )
        }}
      </Query>
    );
  }
}

export default Orders;