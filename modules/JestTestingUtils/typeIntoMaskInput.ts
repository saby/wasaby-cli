// @ts-ignore TODO: конкретно здесь ts не может зарезолвить путь, хотя должен. В теории всё решится алиасом,
// отдельно посмотрю
import userEvent from '@testing-library/user-event';

/**
 * Если в поле ввода отображается маска, то в нём "введено" максимальное количество символов (пустые места заполнены пробелами).
 * userEvent при обычном вызове type/keyboard попытается поставить курсор в конец поля ввода, и получается, что введётся
 * совсем не то значение, которое хотелось. Тут руками управляем кареткой и двигаем её за последний введённый символ.
 * @param input Поле ввода, в которое нужно ввести текст
 * @param text Строка, которую нужно ввести
 */
export async function typeIntoMaskInput(input: HTMLInputElement, text: string): Promise<void> {
    await userEvent.click(input);
    /*
    Заранее маску рассчитать нельзя, она может появиться в процессе ввода. Поэтому нужно запоминать введённые символы
    и искать индекс последнего.
     */
    let lastSymbol = '';
    for (let i = 0; i < text.length; i++) {
        const caredIndex = i === 0 ? 0 : input.value.lastIndexOf(lastSymbol) + 1;
        await userEvent.type(input, text[i], {
            initialSelectionEnd: caredIndex,
            initialSelectionStart: caredIndex,
            skipClick: true
        });
        lastSymbol = text[i];
    }
}
