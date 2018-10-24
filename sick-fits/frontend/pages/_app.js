import App, { Container } from "next/app";
import Page from '../components/Page';
import { ApolloProvider } from "react-apollo";
import withData from "../lib/withData";

class MyApp extends App {
  // getInitialProps is a next.js method that will run before render
  //    Anything returned from this function will be available in this.props
  //    which means it can be desctructured from this.props below,
  //    just inside the render method.
  static async getInitialProps({ Component, ctx }) {
    let pageProps = {};
    // this (immediately below) crawls the page to gather any queries or mutations
    // and fetches that data. Then we return it, which, again
    // makes it available in this.props.
    // Since this wraps every page, these are available on every page.
    // This isn't necessary in a client-rendered app (i.e. a normal React app)
    // But it's necessary because of the way SSR apps work
    // (Wes says it confuses him... this code comes from next.js and apollo docs)
    if (Component.getInitialProps) {
      pageProps = await Component.getInitialProps(ctx);
    }
    // this exposes the query to the user
    pageProps.query = ctx.query;
    return { pageProps };
  }
  render() {
    const { Component, apollo, pageProps } = this.props;
    return (
      <Container>
        <ApolloProvider client={apollo}>
          <Page>
            <Component {...pageProps} />
          </Page>
        </ApolloProvider>

      </Container>
    );
  }
}

export default withData(MyApp);