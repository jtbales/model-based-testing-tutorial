import React from "react";
import "../Order.css";
import Button from "@material-ui/core/Button";
import { Machine } from "xstate";
import { useMachine } from "@xstate/react";

type OrderServices = {
  submitOrder: () => Promise<any>;
};

// Makeshift dependency injection to simplify tutorial
type OrderProps = {
  services?: OrderServices;
};

const getServices = (): OrderServices => ({
  // Added service to simulate asynchronous calls to external applications
  submitOrder: () => {
    const delay = 1000;

    if (Math.random() < 0.5) {
      return new Promise((resolve) => setTimeout(resolve, delay));
    }
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Order Failed")), delay)
    );
  },
});

const createOrderMachine = (services: OrderServices) =>
  Machine(
    {
      id: "order",
      initial: "shopping",
      states: {
        shopping: { on: { ADD_TO_CART: "cart" } },
        cart: { on: { PLACE_ORDER: "placingOrder", CANCEL: "shopping" } },
        // Waiting state
        placingOrder: {
          invoke: {
            src: "submitOrder",
            onDone: "ordered",
            onError: "orderFailed",
          },
        },
        // Failed state
        orderFailed: {
          on: { PLACE_ORDER: "placingOrder", CANCEL: "shopping" },
        },
        ordered: { on: { CONTINUE_SHOPPING: "shopping" } },
      },
    },
    {
      services: {
        ...services,
      },
    }
  );

const Order: React.FC<OrderProps> = ({ services }) => {
  const [orderMachineState, send] = useMachine(
    createOrderMachine(services ?? getServices())
  );

  return (
    <div className="container">
      <h1>{orderMachineState.value}</h1>
      <div className="buttons">
        {orderMachineState.value === "shopping" && (
          <Button
            variant="contained"
            color="primary"
            onClick={() => send("ADD_TO_CART")}
          >
            Add to cart
          </Button>
        )}
        {(orderMachineState.value === "cart" ||
          orderMachineState.value === "orderFailed") && (
          <Button
            variant="contained"
            color="primary"
            onClick={() => send("PLACE_ORDER")}
          >
            Place Order
          </Button>
        )}
        {(orderMachineState.value === "cart" ||
          orderMachineState.value === "orderFailed") && (
          <Button variant="contained" onClick={() => send("CANCEL")}>
            Cancel
          </Button>
        )}
        {orderMachineState.value === "ordered" && (
          <Button variant="contained" onClick={() => send("CONTINUE_SHOPPING")}>
            Continue Shopping
          </Button>
        )}
      </div>
    </div>
  );
};

export default Order;
