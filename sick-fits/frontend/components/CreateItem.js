import React, { Component } from 'react';
import { Mutation } from "react-apollo";
import Router from "next/router";
import gql from "graphql-tag";
import Error from "./ErrorMessage";
import Form from "./styles/Form";
import formatMoney from "../lib/formatMoney";

const CREATE_ITEM_MUTATION = gql`
mutation CREATE_ITEM_MUTATION(
    $title: String!
    $description: String!
    $price: Int!
    $image: String
    $largeImage: String
) {
  createItem(
    title: $title
    description: $description
    price: $price
    image: $image
    largeImage: $largeImage
  ) {
    id
  }
}
`;

class CreateItem extends Component {
  state = {
    title: "",
    description: '',
    image: '',
    largeImage: '',
    price: 0
  };

  handleInputChange = e => {
    const { name, type, value } = e.target;
    const val = type === 'number' ? parseFloat(value) : value;
    this.setState({
      [name]: val
    })
  };

  uploadFile = async event => {
    console.log('uploading file...');
    const files = event.target.files;
    const data = new FormData();
    data.append('file', files[0]);
    data.append('upload_preset', 'sickfits');

    const res = await fetch('https://api.cloudinary.com/v1_1/dm6eoegii/image/upload/', {
      method: 'POST',
      body: data
    });
    const file = await res.json();
    console.log(file);
    this.setState({
      image: file.secure_url,
      largeImage: file.eager[0].secure_url
    });
  }

  render() {
    return (
      <Mutation mutation={CREATE_ITEM_MUTATION} variables={this.state}>
        {(createItem, { loading, error }) => (
          <Form
            onSubmit={async e => {
              // stop the form from submitting
              e.preventDefault();
              // call the mutation
              const res = await createItem();
              // reroute to the new item page
              Router.push({
                pathname: "/item",
                query: { id: res.data.createItem.id }
              })
            }}
          >
          {this.state.image && <img src={this.state.image} alt="Upload Preview" />}
            <Error error={error} />
            <fieldset disabled={loading} aria-busy={loading}>
              <label htmlFor="file">
                Image
                <input
                  type="file"
                  id="file"
                  name="file"
                  onChange={this.uploadFile}
                  placeholder="Upload an image"
                  required
                />
              </label>

              <label htmlFor="title">
                Title
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={this.state.title}
                  onChange={this.handleInputChange}
                  placeholder="Title"
                  required
                />
              </label>

              <label htmlFor="price">
                Price
                <input
                  type="number"
                  id="price"
                  name="price"
                  value={this.state.price}
                  onChange={this.handleInputChange}
                  placeholder="Price"
                  required
                />
              </label>

              <label htmlFor="description">
                Description
                <textarea
                  id="description"
                  name="description"
                  value={this.state.description}
                  onChange={this.handleInputChange}
                  placeholder="Enter a desciption"
                  required
                />
              </label>
              <button type="submit">Submit</button>
            </fieldset>
          </Form>
        )}
      </Mutation>
    );
  }
}

export default CreateItem;

export { CREATE_ITEM_MUTATION };