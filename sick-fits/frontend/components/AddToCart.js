import React from "react";
import { Mutation } from "react-apollo";
import gql from "graphql-tag";

const ADD_TO_CART_MUTATION = gql`
  mutation addToCart($id: ID!) {
    id
    quantity
  }
`;

class AddToCart extends React.Component {
  render() {
    const { id } = this.props;
    return (
      <Mutation mutation={ADD_TO_CART_MUTATION} variables={{ id }}>
        {addToCart => (
          <button onClick={addToCart}>Add to Cart</button>
        )}
      </Mutation>
    )
  }
}

export default AddToCart;