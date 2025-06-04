   // Fix input focus issue
        document.querySelectorAll('.input-group input').forEach(input => {
            input.addEventListener('focus', function() {
                this.parentNode.querySelector('label').style.transform = 'translateY(-1.75rem)';
                this.parentNode.querySelector('label').style.fontSize = '0.75rem';
                this.parentNode.querySelector('label').style.color = 'white';
            });
            
            input.addEventListener('blur', function() {
                if (this.value === '') {
                    this.parentNode.querySelector('label').style.transform = '';
                    this.parentNode.querySelector('label').style.fontSize = '';
                    this.parentNode.querySelector('label').style.color = 'rgba(255, 255, 255, 0.7)';
                }
            });
        });
        
        // Toggle password visibility and animate lock
        function togglePassword() {
            const passwordInput = document.getElementById('password');
            const eyeIcon = document.getElementById('eyeIcon');
            const lock = document.getElementById('lock');
            
            if (passwordInput.type === 'password') {
                // Show password
                passwordInput.type = 'text';
                eyeIcon.innerHTML = `
                    <path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd" />
                    <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                `;
                // Unlock the lock
                lock.classList.add('unlocked');
            } else {
                // Hide password
                passwordInput.type = 'password';
                eyeIcon.innerHTML = `
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
                `;
                // Lock the lock
                lock.classList.remove('unlocked');
            }
        }
        
        // Simple form validation
        document.querySelector('form').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            if (username === 'admin' && password === 'admin123') {
                // Animate lock before redirecting
                const lock = document.getElementById('lock');
                lock.classList.add('unlocked');
                
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 600);
            } else {
                alert('Username atau password salah. Silakan coba lagi.');
            }
        });
    