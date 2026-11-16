document.addEventListener('DOMContentLoaded', () => {
  if (!window.RADAR_DATA) {
    console.error('No RADAR_DATA found');
    return;
  }

  const data = window.RADAR_DATA;
  let rows = data.rows || [];
  let currentFilter = 'watchlist'; // 'all', 'pre', 'live', 'watchlist'
  let currentCategory = 'all';
  let searchTerm = '';
  let sortColumn = 'score';
  let sortDirection = 'desc'; // 'asc' or 'desc'

  // Populate Header Metrics
  document.getElementById('metric-total').textContent = data.total_protocols.toLocaleString();
  document.getElementById('metric-watchlist').textContent = data.watchlist_size.toLocaleString();
  document.getElementById('metric-early').textContent = data.early_size.toLocaleString();
  document.getElementById('metric-tvl').textContent = '$' + Math.round(data.total_tvl_usd / 1e6).toLocaleString() + 'M';
  document.getElementById('metric-implied').textContent = '$' + Math.round(data.total_implied_value_usd / 1e6).toLocaleString() + 'M';

  // Populate Category Filter dropdown
  const categories = Array.from(new Set(rows.map(r => r.category))).filter(Boolean).sort();
  const catSelect = document.getElementById('category-filter');
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    catSelect.appendChild(opt);
  });

  // Event Listeners
  document.getElementById('search-input').addEventListener('input', (e) => {
    searchTerm = e.target.value.toLowerCase().trim();
    renderTable();
  });

  catSelect.addEventListener('change', (e) => {
    currentCategory = e.target.value;
    renderTable();
  });

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.getAttribute('data-filter');
      renderTable();
    });
  });

  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-sort');
      if (sortColumn === col) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        sortColumn = col;
        sortDirection = 'desc';
      }
      updateSortIndicators();
      renderTable();
    });
  });

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  function updateSortIndicators() {
    document.querySelectorAll('th[data-sort]').forEach(th => {
      th.classList.remove('sorted-asc', 'sorted-desc');
      if (th.getAttribute('data-sort') === sortColumn) {
        th.classList.add(sortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
      }
    });
  }

  function filterAndSortRows() {
    let filtered = rows.filter(r => {
      // Filter tab
      if (currentFilter === 'pre' && r.status !== 'Pre-Token') return false;
      if (currentFilter === 'live' && r.status !== 'Live Token') return false;
      if (currentFilter === 'watchlist' && !r.is_watchlist) return false;

      // Category filter
      if (currentCategory !== 'all' && r.category !== currentCategory) return false;

      // Search term
      if (searchTerm) {
        const matchName = r.name.toLowerCase().includes(searchTerm);
        const matchSlug = r.slug.toLowerCase().includes(searchTerm);
        const matchCat = r.category.toLowerCase().includes(searchTerm);
        const matchChain = r.chains.some(c => c.toLowerCase().includes(searchTerm));
        if (!matchName && !matchSlug && !matchCat && !matchChain) return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      let valA = a[sortColumn];
      let valB = b[sortColumn];

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }
      if (valA === null || valA === undefined) valA = 0;
      if (valB === null || valB === undefined) valB = 0;

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }

  function renderTable() {
    const tbody = document.getElementById('table-body');
    const matchedRows = filterAndSortRows();
    document.getElementById('results-count').textContent = `Showing ${matchedRows.length} protocols`;

    if (matchedRows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No matching protocols found.</td></tr>`;
      return;
    }

    tbody.innerHTML = matchedRows.map(r => {
      const tvlFormatted = '$' + (r.tvl_usd >= 1e9 ? (r.tvl_usd / 1e9).toFixed(2) + 'B' : (r.tvl_usd / 1e6).toFixed(1) + 'M');
      const impliedFormatted = '$' + (r.implied_value_usd >= 1e9 ? (r.implied_value_usd / 1e9).toFixed(2) + 'B' : (r.implied_value_usd / 1e6).toFixed(1) + 'M');
      const changeClass = r.change_7d >= 0 ? 'positive' : 'negative';
      const changeStr = (r.change_7d >= 0 ? '+' : '') + r.change_7d.toFixed(1) + '%';
      let statusBadge = '';
      if (r.status === 'Pre-Token') {
        statusBadge = '<span class="badge badge-pre">Pre-Token</span>';
      } else if (r.status === 'Live Token') {
        statusBadge = '<span class="badge badge-live">Live Token</span>';
      } else {
        statusBadge = `<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #ef4444;" title="${r.reason || 'Ineligible'}">Ineligible</span>`;
      }
      const watchlistBadge = r.is_watchlist ? '<span class="badge badge-watchlist" title="Floor Watchlist">Watchlist</span>' : '';

      return `
        <tr data-slug="${r.slug}">
          <td>
            <div style="font-weight: 600; color: var(--text-main);">${r.name}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${r.slug}</div>
          </td>
          <td>${statusBadge} ${watchlistBadge}</td>
          <td><span class="mono">${tvlFormatted}</span></td>
          <td><span class="mono ${changeClass}">${changeStr}</span></td>
          <td><span class="mono" style="color: var(--accent-emerald); font-weight: 600;">${impliedFormatted}</span></td>
          <td><span class="mono">${r.implied_multiple}x</span></td>
          <td>${r.category}</td>
        </tr>
      `;
    }).join('');

    // Attach row click listeners for detail modal
    tbody.querySelectorAll('tr[data-slug]').forEach(tr => {
      tr.addEventListener('click', () => {
        const slug = tr.getAttribute('data-slug');
        const rowData = rows.find(x => x.slug === slug);
        if (rowData) openModal(rowData);
      });
    });
  }

  function openModal(r) {
    const modal = document.getElementById('modal-overlay');
    document.getElementById('modal-name').textContent = r.name;
    document.getElementById('modal-slug').textContent = `Slug: ${r.slug} | Category: ${r.category} | Chains: ${(r.chains || []).join(', ') || 'N/A'}`;
    
    document.getElementById('modal-tvl').textContent = '$' + r.tvl_usd.toLocaleString();
    const chClass = r.change_7d >= 0 ? 'positive' : 'negative';
    const chText = (r.change_7d >= 0 ? '+' : '') + r.change_7d.toFixed(2) + '%';
    const chEl = document.getElementById('modal-change');
    chEl.textContent = chText;
    chEl.className = 'metric-value ' + chClass;

    document.getElementById('modal-implied').textContent = '$' + r.implied_value_usd.toLocaleString();
    document.getElementById('modal-multiple').textContent = r.implied_multiple + 'x';
    document.getElementById('modal-score').textContent = r.score.toLocaleString();

    const statusEl = document.getElementById('modal-status');
    statusEl.innerHTML = r.status === 'Pre-Token' ? '<span class="badge badge-pre">Pre-Token Opportunity</span>' : '<span class="badge badge-live">Live Token Trading</span>';
    if (r.is_watchlist) statusEl.innerHTML += ' <span class="badge badge-watchlist">Watchlist Floor</span>';

    // Farm Plan
    const fp = r.farm_plan || {};
    document.getElementById('farm-strategy').textContent = fp.strategy || 'Standard Liquidity Provision';
    const stepsList = document.getElementById('farm-steps');
    stepsList.innerHTML = (fp.steps || []).map(s => `<li>${s}</li>`).join('');
    document.getElementById('farm-cost').textContent = '$' + (fp.cost_usd || 25);
    document.getElementById('farm-time').textContent = (fp.time_days || 30) + ' Days';

    modal.classList.add('open');
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
  }

  updateSortIndicators();
  renderTable();
});
