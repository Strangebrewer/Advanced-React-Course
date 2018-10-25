import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Link from "next/link";
import Title from "./styles/Title";
import ItemStyles from "./styles/ItemStyles";
import PriceTag from "./styles/PriceTag";
import Items from './Items';
import DeleteItem from "./DeleteItem";
import formatMoney from "../lib/formatMoney";

class Item extends Component {
  static propTypes = {
    item: PropTypes.object.isRequired,
  }
  render() {
    const { item } = this.props;
    return (
      <div>
        <ItemStyles>
          {item.image && <img src={item.image} alt={item.title} />}
          {/* the above is the equivalent of {item.image ? <img {...etc} /> : null} */}
          {/* cool! */}
          <Title>
            <Link href={{
              pathname: "/item",
              query: { id: item.id }
            }}>
              <a>{item.title}</a>
            </Link>
          </Title>
          <PriceTag>{formatMoney(item.price)}</PriceTag>
          <p>{item.description}</p>
          <div className="buttonList">
            <Link href={{
              pathname: "/update",
              query: { id: item.id }
            }}>
              <a>Edit</a>
            </Link>
            <button>Add to Cart</button>
            <DeleteItem id={item.id}>Delete Item</DeleteItem>
          </div>
        </ItemStyles>
      </div>
    );
  }
}

export default Item;