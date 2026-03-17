// Load user info
fetch('/api/me')
    .then(res => {
        if (!res.ok) window.location.href = '/login.html';
        return res.json();
    })
    .then(user => {
        document.getElementById('userName').textContent = user.name;
        document.getElementById('userEmail').textContent = user.email;
        if (user.photo_url) {
            document.getElementById('userPhoto').innerHTML = `<img src="${user.photo_url}" style="width:80px;height:80px;border-radius:50%;">`;
        } else {
            document.getElementById('userPhoto').textContent = user.name.charAt(0);
        }
    });

// Toggle add item form
document.getElementById('showAddItemForm').addEventListener('click', () => {
    document.getElementById('addItemForm').style.display = 'block';
});

// Add item
document.getElementById('itemForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    const res = await fetch('/api/user-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    const result = await res.json();
    if (result.success) {
        // Display QR code
        const itemsDiv = document.getElementById('itemsList');
        const itemCard = document.createElement('div');
        itemCard.className = 'item-card';
        itemCard.innerHTML = `
            <h4>${data.item_name}</h4>
            <p>${data.description || ''}</p>
            <p><strong>Code:</strong> ${result.item_code}</p>
            <img src="${result.qrDataUrl}" style="width:150px;height:150px;">
            <a href="${result.qrDataUrl}" download="qr-${result.item_code}.png" class="btn btn-secondary">Download QR</a>
        `;
        itemsDiv.appendChild(itemCard);
        document.getElementById('itemForm').reset();
        document.getElementById('addItemForm').style.display = 'none';
    } else {
        alert('Error: ' + result.error);
    }
});

// Load existing items
fetch('/api/user-items')
    .then(res => res.json())
    .then(items => {
        const itemsDiv = document.getElementById('itemsList');
        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'item-card';
            // You can generate QR on fly or store it; we'll generate a data URL
            QRCode.toDataURL(`https://hma-lost-found-production.up.railway.app/report.html?code=${item.item_code}`, (err, url) => {
                card.innerHTML = `
                    <h4>${item.item_name}</h4>
                    <p>${item.description || ''}</p>
                    <p><strong>Code:</strong> ${item.item_code}</p>
                    <img src="${url}" style="width:150px;height:150px;">
                    <a href="${url}" download="qr-${item.item_code}.png" class="btn btn-secondary">Download QR</a>
                `;
                itemsDiv.appendChild(card);
            });
        });
    });