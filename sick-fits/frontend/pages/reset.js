import Reset from "../components/Reset";

const Bullshit = props => (
  <div>
    <p>Reset your password {props.query.resetToken}</p>
    <Reset resetToken={props.query.resetToken} />
  </div>
);

export default Bullshit;