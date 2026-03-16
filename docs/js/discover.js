document.addEventListener('DOMContentLoaded', async () => {
    console.log('Discover page loaded');
    
    const qrGrid = document.getElementById('qr-items-grid');
    const unknownGrid = document.getElementById('unknown-items-grid');

    if (!qrGrid || !unknownGrid) {
        console.error('Grid elements not found');
        return;
    }

    // Fetch QR reports
    try {
        console.log('Fetching QR reports...');
        const qrRes = await fetch('/api/recent-qr');
        if (!qrRes.ok) throw new Error('Failed to fetch QR reports');
        const qrReports = await qrRes.json();
        console.log('QR reports:', qrReports);
        
        if (qrReports.length === 0) {
            qrGrid.innerHTML = '<p class="no-items">No QR-tagged items reported yet.</p>';
        } else {
            qrGrid.innerHTML = qrReports.map(item => `
                <div class="item-card">
                    ${item.photo_url ? `<img src="${item.photo_url}" alt="Found item">` : '<div class="no-photo">📷 No photo</div>'}
                    <div class="item-info">
                        <h4>${item.item_name || 'Unknown item'}</h4>
                        <p>📍 ${item.location || 'Unknown location'}</p>
                        <p>👤 Owner: ${item.owner_name || 'Unknown'}</p>
                        <p>📝 ${item.notes || 'No notes'}</p>
                        <small>${item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Recently'}</small>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading QR reports:', error);
        qrGrid.innerHTML = '<p class="error">Failed to load QR reports.</p>';
    }

    // Fetch unknown items
    try {
        console.log('Fetching unknown items...');
        const unkRes = await fetch('/api/unknown');
        if (!unkRes.ok) throw new Error('Failed to fetch unknown items');
        const unknownItems = await unkRes.json();
        console.log('Unknown items:', unknownItems);
        
        if (unknownItems.length === 0) {
            unknownGrid.innerHTML = '<p class="no-items">No unknown items reported yet.</p>';
        } else {
            unknownGrid.innerHTML = unknownItems.map(item => `
                <div class="item-card">
                    ${item.photo_url ? `<img src="${item.photo_url}" alt="Unknown item">` : '<div class="no-photo">📷 No photo</div>'}
                    <div class="item-info">
                        <h4>📍 ${item.location || 'Unknown location'}</h4>
                        <p>📝 ${item.notes || 'No description'}</p>
                        <small>${item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Recently'}</small>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading unknown items:', error);
        unknownGrid.innerHTML = '<p class="error">Failed to load unknown items.</p>';
    }
});