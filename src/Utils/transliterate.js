const charMap = new Map([
    ['а', 'a'],
    ['б', 'b'],
    ['в', 'v'],
    ['г', 'g'],
    ['д', 'd'],
    ['е', 'e'],
    ['ё', 'e'],
    ['ж', 'j'],
    ['з', 'z'],
    ['и', 'i'],
    ['й', 'j'],
    ['к', 'k'],
    ['л', 'l'],
    ['м', 'm'],
    ['н', 'n'],
    ['о', 'o'],
    ['п', 'p'],
    ['р', 'r'],
    ['с', 's'],
    ['т', 't'],
    ['у', 'u'],
    ['ф', 'f'],
    ['х', 'h'],
    ['ц', 'ts'],
    ['ч', 'ch'],
    ['ш', 'sh'],
    ['щ', 'sch'],
    ['ъ', ''],
    ['ы', 'y'],
    ['ь', ''],
    ['э', 'e'],
    ['ю', 'yu'],
    ['я', 'ya'],
    [' ', '_']
]);

new Map(charMap).forEach((value, key) => {
    charMap.set(key.toUpperCase(), value.toUpperCase());
});

function transliterate(input) {
    let result = '';

    for (const char of input) {
        if (charMap.has(char)) {
            result += charMap.get(char);
        } else {
            result += char;
        }
    }

    return result;
}

module.exports = transliterate;
