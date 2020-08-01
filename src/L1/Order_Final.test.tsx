import { createModel } from "@xstate/test";
import { Machine } from "xstate";
import Order, { getOrderMachineDefinition } from "./Order";
import { render, RenderResult, fireEvent, wait } from "@testing-library/react";
import React from "react";

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
    const testMachineDefinition = getOrderMachineDefinition();

    (testMachineDefinition.states.shopping as any).meta = shoppingTest;
    (testMachineDefinition.states.cart as any).meta = cartTest;
    (testMachineDefinition.states.ordered as any).meta = orderedTest;

    const testMachine = Machine(testMachineDefinition);

    const testModel = createModel(testMachine).withEvents(
      getEventConfigs() as any
    );

    const testPlans = testModel.getSimplePathPlans();

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
