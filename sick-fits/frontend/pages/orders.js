import PleaseSignIn from "../components/PleaseSignIn";
// import Orders from "../components/Orders";
import OrderList from "../components/OrderList";

const OrdersPage = props => (
  <div>
    <PleaseSignIn>
      {/* <Orders /> */}
      <OrderList />
    </PleaseSignIn>
  </div>
);

export default OrdersPage;