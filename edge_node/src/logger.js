/**
 * Simple logger utility
 */
export function createLogger(name) {
    const prefix = `[${name}]`;
    
    return {
        info: (...args) => console.log(prefix, ...args),
        warn: (...args) => console.warn(prefix, ...args),
        error: (...args) => console.error(prefix, ...args),
        debug: (...args) => {
            if (process.env.DEBUG || process.env.TODOFORAI_DEBUG) {
                console.log(prefix, '[DEBUG]', ...args);
            }
        }
    };
}