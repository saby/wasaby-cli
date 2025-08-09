import Bootstrap from 'UI/Bootstrap';
import { FocusRoot } from 'UI/Focus';
import { Container as PopupContainer } from 'Controls/popup';
import { ReactNode } from 'react';

interface IProps {
    children: ReactNode;
}

export function App({children}: IProps) {
    // @ts-ignore На самом деле HotkeysController необязателен
    return <Bootstrap>
        <FocusRoot as="div">
            <>
                <PopupContainer/>
                {children}
            </>
        </FocusRoot>
    </Bootstrap>;
}
