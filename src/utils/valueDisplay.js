export function shouldUseDitto(value, previousValue, previousVisible) {
    return previousVisible && value === previousValue;
}
