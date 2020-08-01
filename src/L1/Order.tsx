import React from "react";
import "../Order.css";
import Button from "@material-ui/core/Button";
import { Machine } from "xstate";
import { useMachine } from "@xstate/react";

const getOrderMachineDefinition = () => ({
  id: "order",
  initial: "shopping",
  states: {
    shopping: { on: { ADD_TO_CART: "cart" } },
    cart: { on: { PLACE_ORDER: "ordered" } },
    ordered: {},
  },
});

const Order: React.FC = () => {
  const [orderMachineState, send] = useMachine(
    Machine(getOrderMachineDefinition())
  );

  return (
    <div className="container">
      <h1>{orderMachineState.value}</h1>
      <div className="buttons">
        <Button
          variant="contained"
          color="primary"
          onClick={() => send("ADD_TO_CART")}
        >
          Add to cart
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => send("PLACE_ORDER")}
        >
          Place Order
        </Button>
      </div>
    </div>
  );
};

export default Order;
export { getOrderMachineDefinition };
