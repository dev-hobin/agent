export function createJsonlDecoder({ onValue, onError }) {
  let buffer = "";

  const consume = (line) => {
    const record = line.endsWith("\r") ? line.slice(0, -1) : line;
    if (!record) return;
    try {
      onValue(JSON.parse(record));
    } catch (error) {
      onError(error, record);
    }
  };

  return {
    push(chunk) {
      buffer += chunk;
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        consume(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }
    },
    end() {
      if (!buffer) return;
      onError(new Error("RPC stream ended with an unterminated JSONL record"), buffer);
      buffer = "";
    },
  };
}
