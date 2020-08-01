import { createModel } from "@xstate/test";
import { Machine, assign } from "xstate";
import Order from "./Order";
import { render, RenderResult, fireEvent, wait } from "@testing-library/react";
import React from "react";

const getTestMachine = () =>
  Machine(
    {
      id: "order",
      initial: "shopping",
      context: {
        cartsCanceled: 0,
        ordersCompleted: 0,
      },
      states: {
        shopping: { on: { ADD_TO_CART: "cart" } },
        cart: {
          on: {
            PLACE_ORDER: "ordered",
            CANCEL: { actions: ["cartCanceled"], target: "shopping" },
          },
        },
        ordered: {
          on: {
            CONTINUE_SHOPPING: {
              actions: ["orderCompleted"],
              target: "shopping",
            },
          },
        },
      },
    },
    {
      actions: {
        cartCanceled: assign((context) => ({
          cartsCanceled: context.cartsCanceled + 1,
        })),
        orderCompleted: assign((context) => ({
          ordersCompleted: context.ordersCompleted + 1,
        })),
      },
    }
  );

const getEventConfigs = () => {
  const eventConfigs = {
    ADD_TO_CART: {
      exec: async ({ getByText }: RenderResult) => {
        fireEvent.click(getByText("Add to cart"));
      },
    },
    PLACE_ORDER: {
      exec: async ({ getByText }: RenderResult) => {
        fireEvent.click(getByText("Place Order"));
      },
    },
    CONTINUE_SHOPPING: {
      exec: async ({ getByText }: RenderResult) => {
        fireEvent.click(getByText("Continue Shopping"));
      },
    },
    CANCEL: {
      exec: async ({ getByText }: RenderResult) => {
        fireEvent.click(getByText("Cancel"));
      },
    },
  };

  return eventConfigs;
};

const shoppingTest = {
  test: async ({ getByText }: RenderResult) => {
    await wait(() => expect(() => getByText("shopping")).not.toThrowError());
  },
};
const cartTest = {
  test: async ({ getByText }: RenderResult) => {
    await wait(() => expect(() => getByText("cart")).not.toThrowError());
  },
};
const orderedTest = {
  test: async ({ getByText }: RenderResult) => {
    await wait(() => expect(() => getByText("ordered")).not.toThrowError());
  },
};

describe("Order", () => {
  describe("matches all paths", () => {
    const testMachine = getTestMachine();

    (testMachine.states.shopping as any).meta = shoppingTest;
    (testMachine.states.cart as any).meta = cartTest;
    (testMachine.states.ordered as any).meta = orderedTest;

    const testModel = createModel(testMachine).withEvents(
      getEventConfigs() as any
    );

    const testPlans = testModel.getShortestPathPlans({
      filter: (state) =>
        state.context.ordersCompleted <= 1 && state.context.cartsCanceled <= 1,
    });

    testPlans.forEach((plan) => {
      describe(plan.description, () => {
        plan.paths.forEach((path) => {
          it(path.description, async () => {
            await path.test(render(<Order />));
          });
        });
      });
    });

    it("should have full coverage", () => {
      return testModel.testCoverage();
    });
  });
});
