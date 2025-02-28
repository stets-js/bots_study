function deepLogger(label, data, seen = new WeakSet(), indent = 0) {
  const indentation = ' '.repeat(indent);

  function format(value, depth = 0) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'number' || typeof value === 'boolean') return value.toString();

    if (Array.isArray(value)) {
      if (value.length === 0) return '[]';
      return `[\n${value
        .map(item => indentation + '  ' + format(item, depth + 1))
        .join(',\n')}\n${indentation}]`;
    }

    if (typeof value === 'object') {
      if (seen.has(value)) return '{ Circular Reference }'; // Avoid infinite loops in circular structures
      seen.add(value);

      if (value instanceof Error) {
        return `{ Error: ${value.message}, Stack: ${value.stack} }`;
      }

      const keys = Object.keys(value);
      if (keys.length === 0) return '{}';

      return `{\n${keys
        .map(key => indentation + '  ' + key + ': ' + format(value[key], depth + 1))
        .join(',\n')}\n${indentation}}`;
    }

    return value.toString();
  }

  console.log(`[${new Date().toISOString()}] ${label}:`, format(data));
}

module.exports = deepLogger;
