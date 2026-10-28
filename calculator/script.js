"use strict";

const SYMBOLS = { "+": "+", "-": "−", "*": "×", "/": "÷" };
const NUMBER_PATTERN = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;
const MAX_HISTORY = 10;

/* ---------- Arithmetic engine ---------- */
function calculate(number1, number2, operation) {
  switch (operation) {
    case "+":
      return number1 + number2;
    case "-":
      return number1 - number2;
    case "*":
      return number1 * number2;
    case "/":
      if (number2 === 0) {
        throw new Error("Cannot divide by zero.");
      }
      return number1 / number2;
    default:
      throw new Error("Please select a valid operation.");
  }
}

/* ---------- Formatting (display only, never alters the real value) ---------- */
function formatNumber(value) {
  if (!Number.isFinite(value)) return "Result out of range";
  if (value === 0) return "0";

  // Trim floating-point noise such as 0.1 + 0.2 = 0.30000000000000004
  const cleaned = Number(value.toPrecision(12));
  const abs = Math.abs(cleaned);

  if (abs >= 1e15 || abs < 1e-6) {
    return cleaned.toExponential().replace("e+", "e");
  }
  return cleaned.toLocaleString("en-US", { maximumFractionDigits: 12, useGrouping: false });
}

/* ---------- DOM ---------- */
if (typeof document !== "undefined") {
  const els = {
    number1: document.getElementById("number1"),
    number2: document.getElementById("number2"),
    error1: document.getElementById("error1"),
    error2: document.getElementById("error2"),
    errorOp: document.getElementById("errorOp"),
    result: document.getElementById("result"),
    expression: document.getElementById("expression"),
    calculateBtn: document.getElementById("calculateBtn"),
    clearBtn: document.getElementById("clearBtn"),
    swapBtn: document.getElementById("swapBtn"),
    copyBtn: document.getElementById("copyBtn"),
    historyList: document.getElementById("historyList"),
    toast: document.getElementById("toast"),
  };
  const history = [];
  let lastResultText = "";
  let toastTimer;

  const getOperation = () => {
    const checked = document.querySelector('input[name="operation"]:checked');
    return checked ? checked.value : null;
  };

  function setFieldError(input, errorEl, message) {
    errorEl.textContent = message;
    if (input) input.setAttribute("aria-invalid", message ? "true" : "false");
  }

  function clearErrors() {
    setFieldError(els.number1, els.error1, "");
    setFieldError(els.number2, els.error2, "");
    setFieldError(null, els.errorOp, "");
  }

  // Empty strings are checked first because Number("") is 0.
  function validateField(raw, label) {
    const text = raw.trim();
    if (text === "") return { error: `Enter the ${label} number.` };
    if (!NUMBER_PATTERN.test(text)) return { error: "Enter a valid number, like 12, -3.5 or 0.25." };
    const value = Number(text);
    if (!Number.isFinite(value)) return { error: "That number is too large." };
    return { value };
  }

  function validateInputs() {
    clearErrors();
    const first = validateField(els.number1.value, "first");
    const second = validateField(els.number2.value, "second");
    const operation = getOperation();
    let valid = true;

    if (first.error) { setFieldError(els.number1, els.error1, first.error); valid = false; }
    if (second.error) { setFieldError(els.number2, els.error2, second.error); valid = false; }
    if (!operation) { setFieldError(null, els.errorOp, "Select an operation."); valid = false; }

    return valid ? { number1: first.value, number2: second.value, operation } : null;
  }

  function getInputValues() {
    return validateInputs();
  }

  function showResultState(text, expression, { isError = false, isPlaceholder = false } = {}) {
    els.result.textContent = text;
    els.result.classList.toggle("is-error", isError);
    els.result.classList.toggle("placeholder", isPlaceholder);
    els.expression.textContent = expression;
    els.result.classList.remove("pop");
    void els.result.offsetWidth; // restart animation
    if (!isPlaceholder) els.result.classList.add("pop");
  }

  function addHistory(entry) {
    history.unshift(entry);
    if (history.length > MAX_HISTORY) history.pop();
    els.historyList.replaceChildren(
      ...history.map((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        return li;
      })
    );
  }

  function displayResult({ number1, number2, operation }, value) {
    const resultText = formatNumber(value);
    const expression = `${formatNumber(number1)} ${SYMBOLS[operation]} ${formatNumber(number2)} = ${resultText}`;
    lastResultText = resultText;
    showResultState(resultText, expression);
    els.copyBtn.disabled = false;
    addHistory(expression);
  }

  function calculateResult() {
    const inputs = getInputValues();
    if (!inputs) {
      lastResultText = "";
      els.copyBtn.disabled = true;
      showResultState("—", "Fix the highlighted fields to calculate.", { isPlaceholder: true });
      const firstInvalid = document.querySelector('[aria-invalid="true"]');
      if (firstInvalid) firstInvalid.focus();
      return;
    }
    try {
      const value = calculate(inputs.number1, inputs.number2, inputs.operation);
      displayResult(inputs, value);
    } catch (error) {
      lastResultText = "";
      els.copyBtn.disabled = true;
      setFieldError(els.number2, els.error2, error.message);
      showResultState(error.message, `${formatNumber(inputs.number1)} ${SYMBOLS[inputs.operation]} ${formatNumber(inputs.number2)}`, { isError: true });
      els.number2.focus();
    }
  }

  function clearCalculator() {
    els.number1.value = "";
    els.number2.value = "";
    document.querySelector('input[name="operation"][value="+"]').checked = true;
    clearErrors();
    lastResultText = "";
    els.copyBtn.disabled = true;
    showResultState("—", "Enter two numbers to begin.", { isPlaceholder: true });
    els.number1.focus();
  }

  function swapNumbers() {
    [els.number1.value, els.number2.value] = [els.number2.value, els.number1.value];
    clearErrors();
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1800);
  }

  async function copyResult() {
    if (!lastResultText) return;
    try {
      await navigator.clipboard.writeText(lastResultText);
    } catch {
      // Fallback for browsers or file:// pages without clipboard access
      const temp = document.createElement("textarea");
      temp.value = lastResultText;
      document.body.appendChild(temp);
      temp.select();
      const ok = document.execCommand("copy");
      temp.remove();
      if (!ok) { showToast("Couldn't copy. Select the result manually."); return; }
    }
    showToast("Result copied");
  }

  els.calculateBtn.addEventListener("click", calculateResult);
  els.clearBtn.addEventListener("click", clearCalculator);
  els.swapBtn.addEventListener("click", swapNumbers);
  els.copyBtn.addEventListener("click", copyResult);

  [els.number1, els.number2].forEach((input) => {
    input.addEventListener("input", () => {
      if (input.getAttribute("aria-invalid") === "true") {
        setFieldError(input, input === els.number1 ? els.error1 : els.error2, "");
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.target.closest("button, summary")) {
      event.preventDefault();
      calculateResult();
    } else if (event.key === "Escape") {
      clearCalculator();
    }
  });
} else if (typeof module !== "undefined") {
  module.exports = { calculate, formatNumber };
}
