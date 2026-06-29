// ============================================================
// FoodRescue — Analytics, Charts & Animated Counters
// ============================================================

// ── Animated Counter ────────────────────────────────────────

export function animateCounter(element, target, duration = 2000, prefix = '', suffix = '') {
  const start   = Date.now();
  const initial = parseInt(element.dataset.initial || '0');

  const tick = () => {
    const elapsed  = Date.now() - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased    = 1 - Math.pow(1 - progress, 3); // easeOut cubic
    const current  = Math.floor(initial + (target - initial) * eased);
    element.textContent = prefix + current.toLocaleString('en-IN') + suffix;
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function initCounterObserver() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el     = entry.target;
        const target = parseInt(el.dataset.target || '0');
        const prefix = el.dataset.prefix || '';
        const suffix = el.dataset.suffix || '';
        animateCounter(el, target, 2000, prefix, suffix);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('[data-counter]').forEach(el => observer.observe(el));
}

// ── Chart.js Builders ───────────────────────────────────────

const chartDefaults = {
  dark: {
    color:    '#c5ecd3',
    gridColor: 'rgba(255,255,255,0.06)',
    tickColor: '#5ec285'
  },
  light: {
    color:    '#273325',
    gridColor: 'rgba(0,0,0,0.06)',
    tickColor: '#506050'
  }
};

export function buildLineChart(canvasId, labels, datasets, theme = 'dark', title = '') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const t = chartDefaults[theme];
  if (canvas._chart) canvas._chart.destroy();
  const chart = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: t.color, font: { family: 'Space Grotesk', size: 12 } }
        },
        title: {
          display: !!title,
          text: title,
          color: t.color,
          font: { family: 'Space Grotesk', size: 14, weight: 'bold' }
        }
      },
      scales: {
        x: {
          grid:  { color: t.gridColor },
          ticks: { color: t.tickColor, font: { family: 'Inter', size: 11 } }
        },
        y: {
          grid:  { color: t.gridColor },
          ticks: { color: t.tickColor, font: { family: 'Inter', size: 11 } }
        }
      }
    }
  });
  canvas._chart = chart;
  return chart;
}

export function buildDoughnutChart(canvasId, labels, data, colors, theme = 'dark') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const t = chartDefaults[theme];
  if (canvas._chart) canvas._chart.destroy();
  const chart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor:     theme === 'dark' ? '#133d26' : '#fff',
        borderWidth:     3,
        hoverOffset:     8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: t.color, font: { family: 'Space Grotesk', size: 12 }, padding: 16 }
        }
      }
    }
  });
  canvas._chart = chart;
  return chart;
}

export function buildBarChart(canvasId, labels, datasets, theme = 'dark') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const t = chartDefaults[theme];
  if (canvas._chart) canvas._chart.destroy();
  const chart = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: t.color, font: { family: 'Space Grotesk', size: 12 } }
        }
      },
      scales: {
        x: {
          grid:  { color: t.gridColor },
          ticks: { color: t.tickColor, font: { family: 'Inter', size: 11 } }
        },
        y: {
          grid:  { color: t.gridColor },
          ticks: { color: t.tickColor, font: { family: 'Inter', size: 11 } }
        }
      }
    }
  });
  canvas._chart = chart;
  return chart;
}

// ── Demo Chart Data ──────────────────────────────────────────

export function getDemoLineData() {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const today  = new Date();
  const recent = months.slice(Math.max(0, today.getMonth() - 5), today.getMonth() + 1);
  return {
    labels: recent,
    datasets: [{
      label: 'Meals Saved',
      data: [1200, 1450, 1800, 2200, 2600, 3100].slice(-recent.length),
      borderColor:     '#3da668',
      backgroundColor: 'rgba(61,166,104,0.15)',
      fill: true,
      tension: 0.4,
      borderWidth: 2,
      pointBackgroundColor: '#3da668',
      pointRadius: 4
    }, {
      label: 'Food (kg)',
      data: [800, 1100, 1350, 1700, 2000, 2500].slice(-recent.length),
      borderColor:     '#f5921e',
      backgroundColor: 'rgba(245,146,30,0.08)',
      fill: true,
      tension: 0.4,
      borderWidth: 2,
      pointBackgroundColor: '#f5921e',
      pointRadius: 4
    }]
  };
}

export function getDemoDoughnutData() {
  return {
    labels: ['Vegetarian', 'Non-Vegetarian', 'Vegan'],
    data:   [62, 28, 10],
    colors: ['#3da668', '#f5921e', '#93d9ac']
  };
}

export function getDemoBarData() {
  return {
    labels: ['Surat', 'Ahmedabad', 'Vadodara', 'Rajkot', 'Gandhinagar', 'Bhavnagar'],
    datasets: [{
      label: 'Donations',
      data: [420, 310, 180, 140, 95, 80],
      backgroundColor: ['#3da668', '#5ec285', '#93d9ac', '#3da668', '#5ec285', '#93d9ac'],
      borderRadius: 6
    }]
  };
}

// ── Impact Calculator ────────────────────────────────────────

export function computeImpact(kg) {
  return {
    meals:    Math.round(kg * 8),           // ~8 meals per kg
    people:   Math.round(kg * 6),           // feeds ~6 people per kg average
    co2:      parseFloat((kg * 1.8).toFixed(1)), // 1.8 kg CO2 per kg food waste prevented
    water:    Math.round(kg * 500),          // 500L water saved per kg
    monetary: Math.round(kg * 150)           // ₹150 per kg average value
  };
}

// ── Admin Dashboard Charts ───────────────────────────────────

export function initAdminCharts() {
  // Donations trend
  const lineData = getDemoLineData();
  buildLineChart('adminLineChart', lineData.labels, lineData.datasets, 'dark', 'Donation Trend (6 months)');

  // User role distribution
  buildDoughnutChart(
    'adminDoughnutChart',
    ['Restaurants', 'NGOs', 'Volunteers'],
    [850, 280, 1100],
    ['#f5921e', '#3da668', '#93d9ac'],
    'dark'
  );

  // City bar chart
  const barData = getDemoBarData();
  buildBarChart('adminBarChart', barData.labels, barData.datasets, 'dark');
}

// ── Restaurant Dashboard Charts ──────────────────────────────

export function initRestaurantCharts() {
  const lineData = getDemoLineData();
  buildLineChart('restLineChart', lineData.labels, lineData.datasets, 'dark');
  const d = getDemoDoughnutData();
  buildDoughnutChart('restDoughnutChart', d.labels, d.data, d.colors, 'dark');
}

// ── NGO Dashboard Charts ─────────────────────────────────────

export function initNGOCharts() {
  buildBarChart('ngoBarChart', ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], [{
    label: 'Meals Received',
    data: [120, 95, 140, 110, 160, 200, 180],
    backgroundColor: '#3da668',
    borderRadius: 6
  }], 'dark');
}
