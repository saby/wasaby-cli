import Bootstrap from "UI/Bootstrap";
import { WasabyEvents } from "UI/Events";
import { FocusRoot } from "UI/Focus";
import { Container as PopupContainer } from "Controls/popup";
import { ReactNode, useEffect } from "react";

interface IProps {
  children: ReactNode;
}

export function App({ children }: IProps) {
  useEffect(() => {
    WasabyEvents.initInstance(document.body);
    return () => {
      WasabyEvents.destroyInstance(document.body);
    };
  }, []);

  return (
    // @ts-ignore На самом деле HotkeysController необязателен
    <Bootstrap>
      <FocusRoot as="div">
        <>
          <PopupContainer />
          {children}
        </>
      </FocusRoot>
    </Bootstrap>
  );
}
