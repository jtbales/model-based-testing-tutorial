import React, { useState, useEffect } from "react";
import "../Elevator.css";
import Button from "@material-ui/core/Button";
import { Machine } from "xstate";
import Slider from "@material-ui/core/Slider";
import { useMachine } from "@xstate/react";

const getElevatorMachineDefinition = () => ({
  id: "elevator",
  initial: "bottom",
  states: {
    bottom: { on: { GO_UP: "top" } },
    top: { on: { GO_DOWN: "bottom" } },
  },
});

const Elevator: React.FC = () => {
  const [elevatorMachineState, send] = useMachine(
    Machine(getElevatorMachineDefinition())
  );

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
    <div className="container">
      <div>{`Floor ${floor}`}</div>
      <div className="slider">
        <Slider
          name="Elevator"
          disabled
          orientation="vertical"
          getAriaValueText={(value: number) => `Floor ${value}`}
          value={floor}
          aria-labelledby="vertical-slider"
          max={2}
          min={1}
          marks
        />
      </div>
      <div className="buttons">
        <Button
          variant="contained"
          color="primary"
          onClick={() => send("GO_UP")}
        >
          Up
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => send("GO_DOWN")}
        >
          Down
        </Button>
      </div>
    </div>
  );
};

export default Elevator;
export { getElevatorMachineDefinition };
