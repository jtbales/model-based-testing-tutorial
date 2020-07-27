import React, { useState, useEffect } from "react";
import "./Elevator.css";
import Button from "@material-ui/core/Button";
import { createMachine } from "xstate";
import { useMachine } from '@xstate/react';

type ElevatorMachineServices = {
  getMessageAtTop: () => Promise<string>;
};

type ElevatorProps = {
  services: any;
};

const createElevatorMachine = () =>
  createMachine({
    id: "elevator",
    initial: "bottom",
    states: {
      bottom: { on: { GO_UP: "top" } },
      top: { on: { GO_DOWN: "bottom" } },
    },
  });

const Elevator: React.FC = () => {
  const [elevatorMachineState, send] = useMachine(createElevatorMachine())

  const [floor, setFloor] = useState<1 | 2>(1);

  useEffect(() => {

    if (elevatorMachineState.value === "bottom") {
      setFloor(1);
    }
    if (elevatorMachineState.value === "top") {
      setFloor(2);
    }
  }, [elevatorMachineState.value]);

  return (
    <div>
      <div>
        <div>{floor === 1 ? "Floor 1" : ""}</div>
        <div>{floor === 2 ? "Floor 2" : ""}</div>
      </div>
      <div>
        <Button variant="contained" color="primary"  onClick={() => send('GO_UP')} >
          Up
        </Button>
        <Button variant="contained" color="primary" onClick={() => send('GO_DOWN')}>
          Down
        </Button>
      </div>
    </div>
  );
};

export default Elevator;
