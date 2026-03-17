document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const response = await fetch('/api/register', {
        method: 'POST',
        body: formData
    });
    const result = await response.json();
    if (result.success) {
        window.location.href = '/profile.html';
    } else {
        alert('Error: ' + result.error);
    }
});