document.getElementById('manual-report-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);

    try {
        const res = await fetch('/api/unknown', {
            method: 'POST',
            body: formData
        });
        if (res.ok) {
            alert('Item posted to Discover!');
            window.location.href = '/discover.html';
        } else {
            alert('Failed to post item.');
        }
    } catch (err) {
        alert('Error posting item.');
    }
});