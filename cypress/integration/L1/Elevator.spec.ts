/// <reference types="cypress" />

import { createModel } from "@xstate/test";
import { State, StateMachine, Machine } from "xstate";
import { testUrl } from "../Constants";
import { getElevatorMachineDefinition } from "../../../src/L1/Elevator";

// describe("My First Test", () => {
//   it("Visits the Kitchen Sink", () => {
//     cy.log(`Hello!`);
//     cy.visit(testUrl);
//   });
// });

const getEventConfigs = () => {
  const eventConfigs = {
    GO_UP: {
      exec: async (cy: Cypress.cy & EventEmitter) => {
        cy.contains("UP").click();
      },
    },
    GO_DOWN: {
      exec: async (cy: Cypress.cy & EventEmitter) => {
        cy.contains("DOWN").click();
      },
    },
  };

  return eventConfigs;
};

const bottomTest = {
  test: (cy: Cypress.cy & EventEmitter) => {
    cy.contains("Floor 1");
  },
};
const topTest = {
  test: (cy: Cypress.cy & EventEmitter) => {
    cy.contains("Floor 2");
  },
};

describe("Elevator", () => {
  describe("matches all paths", () => {
    const testMachineDefinition = getElevatorMachineDefinition();

    (testMachineDefinition.states.bottom as any).meta = bottomTest;
    (testMachineDefinition.states.top as any).meta = topTest;

    const testMachine = Machine(testMachineDefinition);

    const testModel = createModel(testMachine).withEvents(
      getEventConfigs() as any
    );

    const testPlans = testModel.getSimplePathPlans();

    testPlans.forEach((plan) => {
      describe(plan.description, () => {
        plan.paths.forEach((path) => {
          it(path.description, async () => {
            cy.log(JSON.stringify(path));

            cy.visit(testUrl);
            // path.test(cy);
            return new Cypress.Promise(async (resolve) => {
              await path.test(cy);
              resolve();
            });
          });
        });
      });
    });

    // it("should have full coverage", () => {
    //   // return testModel.testCoverage();
    //   return new Cypress.Promise(async (resolve) => {
    //     await testModel.testCoverage();
    //     resolve();
    //   });
    // });
  });
});
