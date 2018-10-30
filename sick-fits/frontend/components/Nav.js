import Link from "next/link";
import { Mutation } from "react-apollo";
import { TOGGLE_CART_MUTATION } from "./Cart";
import NavStyled from "./styles/NavStyles";
import User from "./User";
import Signout from "./Signout";
import CartCount from "./CartCount";

const Nav = () => (
  <User>
    {({ data: { me } }) => (
      <NavStyled>
        <Link href="/items"><a>Shop</a></Link>
        {me && (
          <>
            <Link href="/sell"><a>Sell</a></Link>
            <Link href="/orders"><a>Orders</a></Link>
            <Link href="/me"><a>Account</a></Link>
            <Signout />
            <Mutation mutation={TOGGLE_CART_MUTATION}>
              {toggleCart => (
                <button onClick={toggleCart}>
                  My Cart
                  <CartCount count={me.cart.reduce((tally, cartItem) => tally + cartItem.quantity, 0)} />
                </button>
              )}
            </Mutation>
          </>
        )}
        {!me && (
          <Link href="/signup"><a>Sign In</a></Link>
        )}
      </NavStyled>
    )}
  </User>
);

export default Nav;