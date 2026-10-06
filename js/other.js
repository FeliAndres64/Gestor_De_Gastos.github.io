// =====================================================
// EVENTOS AUXILIARES
// Bolsillos se gestiona completamente en pockets.js.
// =====================================================

document.body.addEventListener('click', e => {
    if(e.target.closest('#filter-apply')){
        renderHistory({
            from: document.getElementById('filter-from')?.value || '',
            to: document.getElementById('filter-to')?.value || '',
            type: document.getElementById('filter-type')?.value || '',
            text: document.getElementById('filter-text')?.value || ''
        });
    }
});
