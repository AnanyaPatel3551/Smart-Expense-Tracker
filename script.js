let expenses = JSON.parse(localStorage.getItem("expenses")) || [];
let exchangeRates = {};
let monthlySalary = 0;
let spendingThreshold = 0;
let spendingChart;

// DOM Elements
const amountInput = document.getElementById("amount-input");
const expensesTableBody = document.getElementById("expenses-table-body");
const currencySelect = document.getElementById("currency-select");
const popup = document.getElementById("popup-notification"); // Pop-up notification element

// Initialize application
const init = () => {
  loadBudget();
  getExchangeRates();
  loadExpenses();
  updateChart();
  updateAIAdvice();
};

// Load budget from localStorage
const loadBudget = () => {
  const budget = JSON.parse(localStorage.getItem("budget"));
  if (budget) {
    monthlySalary = budget.salary;
    spendingThreshold = budget.threshold;
    document.getElementById("salary-input").value = monthlySalary;
    document.getElementById("threshold-input").value = spendingThreshold;
  }
};

// Fetch exchange rates
const getExchangeRates = async () => {
  try {
    const response = await fetch("https://api.exchangerate-api.com/v4/latest/INR");
    const data = await response.json();
    exchangeRates = data.rates || {};
    populateCurrencyOptions();
  } catch (error) {
    console.error("Using static rates:", error);
    exchangeRates = { INR: 1, USD: 0.012, EUR: 0.011, GBP: 0.0096 };
    populateCurrencyOptions();
  }
};

// Populate currency options
const populateCurrencyOptions = () => {
  currencySelect.innerHTML = Object.keys(exchangeRates)
    .map(currency => `<option value="${currency}">${currency}</option>`)
    .join("");
};

// Add expense handler
document.getElementById("add-btn").addEventListener("click", () => {
  const category = document.getElementById("category-select").value;
  const amount = parseFloat(amountInput.value);
  const date = document.getElementById("date-input").value;

  // Form validation
  if (!category || !amount || !date || amount <= 0) {
    alert("Please fill all fields correctly!");
    return;
  }

  // Add expense to the list
  expenses.push({ category, amount, date });
  updateTable();
  updateTotals();
  saveToLocalStorage();

  // Reset inputs
  amountInput.value = "";
  document.getElementById("date-input").value = ""; // Reset date input to default

  // Show success message
  popup.textContent = "Expense added successfully!";
  popup.style.display = "block";
  setTimeout(() => (popup.style.display = "none"), 3000); // Hide after 3 seconds
});

// Set budget handler
document.getElementById("set-budget-btn").addEventListener("click", () => {
  monthlySalary = parseFloat(document.getElementById("salary-input").value);
  spendingThreshold = parseFloat(document.getElementById("threshold-input").value);

  // Validation
  if (!monthlySalary || !spendingThreshold || monthlySalary <= 0 || spendingThreshold <= 0) {
    alert("Please enter valid salary and threshold values.");
    return;
  }

  localStorage.setItem("budget", JSON.stringify({ salary: monthlySalary, threshold: spendingThreshold }));
  updateAIAdvice();
  updateTotals();

  // Show success message
  popup.textContent = "Budget has been set successfully!";
  popup.style.display = "block";
  setTimeout(() => (popup.style.display = "none"), 3000); // Hide after 3 seconds
});

// Update expense table
const updateTable = () => {
  expensesTableBody.innerHTML = expenses
    .map(
      (expense, index) => `
        <tr>
          <td>${expense.category}</td>
          <td>₹${expense.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          <td>${expense.date}</td>
          <td><button class="delete-btn" onclick="deleteExpense(${index})"><i class="fas fa-trash-alt"></i></button></td>
        </tr>
      `
    )
    .join("");
};

// Delete expense with animation
window.deleteExpense = (index) => {
  if (!confirm("Are you sure you want to delete this expense?")) {
    return;
  }

  // Get the row to delete
  const row = document.querySelector(`#expenses-table-body tr:nth-child(${index + 1})`);

  // Add trash animation class
  const deleteButton = row.querySelector(".delete-btn");
  deleteButton.classList.add("trash-animation");

  // Wait for the animation to complete, then remove the row
  setTimeout(() => {
    expenses.splice(index, 1);
    updateTable();
    updateTotals();
    saveToLocalStorage();
  }, 500); // Match the duration of the animation (0.5s)
};

// Calculate totals
const updateTotals = () => {
  const totalINR = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const selectedCurrency = currencySelect.value || "INR";
  const conversionRate = exchangeRates[selectedCurrency] || 1;
  const convertedTotal = totalINR * conversionRate;

  // Update total displays
  document.getElementById("total-amount").textContent =
    `₹${totalINR.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  document.getElementById("converted-amount").textContent =
    `${selectedCurrency} ${convertedTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  // Check spending threshold
  if (spendingThreshold > 0 && totalINR > spendingThreshold) {
    const overspendAmount = totalINR - spendingThreshold;
    alert(`⚠️ Budget Exceeded! You've overspent by ₹${overspendAmount.toLocaleString("en-IN")}`);
  }

  // Update visualizations
  updateChart();
  updateAIAdvice();
};

// Update spending chart with ApexCharts
const updateChart = () => {
  const categories = expenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {});

  const chartData = {
    labels: Object.keys(categories),
    series: Object.values(categories),
  };

  const options = {
    chart: {
      type: "pie",
      height: 400,
    },
    labels: chartData.labels,
    series: chartData.series,
    colors: ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF"],
    legend: {
      position: "bottom",
    },
    title: {
      text: "Spending by Category",
      align: "center",
    },
    responsive: [
      {
        breakpoint: 768,
        options: {
          chart: {
            height: 300,
          },
          legend: {
            position: "bottom",
          },
        },
      },
    ],
  };

  if (spendingChart) {
    spendingChart.updateOptions(options);
    spendingChart.updateSeries(chartData.series);
  } else {
    spendingChart = new ApexCharts(document.querySelector("#spendingChart"), options);
    spendingChart.render();
  }
};

// Generate AI advice
const updateAIAdvice = () => {
  const adviceContainer = document.getElementById("ai-advice");
  if (!monthlySalary) {
    adviceContainer.innerHTML = "<p>Please set your monthly budget to receive financial advice.</p>";
    return;
  }
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const savings = monthlySalary - totalSpent;
  const categories = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});
  let advice = [];
  const savingsPercentage = (savings / monthlySalary) * 100;

  // Savings advice
  if (savings < 0) {
    advice.push("🚨 Emergency: You're spending more than you earn! Immediate action required.");
  } else if (savingsPercentage < 20) {
    advice.push(`💡 Warning: You're saving only ${savingsPercentage.toFixed(1)}% of your income. Aim for at least 20%.`);
  }

  // Category analysis
  Object.entries(categories).forEach(([category, amount]) => {
    const percentage = (amount / monthlySalary * 100).toFixed(1);
    if (percentage > 30) {
      advice.push(`⚠️ ${category} is consuming ${percentage}% of your income. Consider reducing this expense.`);
    }
  });

  // General tips
  advice.push("💰 Follow the 50/30/20 rule: 50% needs, 30% wants, 20% savings");
  advice.push("📅 Review weekly spending patterns to identify unnecessary expenses");
  advice.push("🎯 Set specific financial goals to stay motivated");

  adviceContainer.innerHTML = advice.map(tip => `<p>• ${tip}</p>`).join("");
};

// Save data
const saveToLocalStorage = () => {
  localStorage.setItem("expenses", JSON.stringify(expenses));
};

// Load expenses
const loadExpenses = () => {
  expenses.forEach(expense => addExpenseToTable(expense, false));
  updateTable();
  updateTotals();
};

// Initialize everything
init();
currencySelect.addEventListener("change", updateTotals);