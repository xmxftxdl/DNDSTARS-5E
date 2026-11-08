export function bountifulUnconsumedParentRows<T extends {consumed?:{transactionId:string}}>(rows:Record<string,T>|undefined):Record<string,T>
