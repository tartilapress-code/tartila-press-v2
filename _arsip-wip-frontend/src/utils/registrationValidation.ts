export default function registrationValidation(
    e: React.ChangeEvent<HTMLInputElement>,
    label: string,
    max_length: number
) {
    const value = e.target.value;

    if (label === 'Password') {
        const passwordCriteria = {
            length: value.length >= max_length,
            lowercase: /[a-z]/.test(value),
            uppercase: /[A-Z]/.test(value),
            number: /[0-9]/.test(value),
            specialChar: /[^A-Za-z0-9]/.test(value),
        };

        if (!passwordCriteria.length) {
            return `Password must be at least ${max_length} characters long.`;
        }
        if (!passwordCriteria.lowercase) {
            return 'Password must contain at least one lowercase letter.';
        }
        if (!passwordCriteria.uppercase) {
            return 'Password must contain at least one uppercase letter.';
        }
        if (!passwordCriteria.number) {
            return 'Password must contain at least one number.';
        }
        if (!passwordCriteria.specialChar) {
            return 'assword must contain at least one special character (eg. @, $, !, %, *, ?, &)';
        }
        if (passwordCriteria) {
            return '';
        }
    }
    if (label === 'Email') {
        const emailCriteria = {
            specialChar:
                /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value),
        };

        if (!emailCriteria.specialChar) {
            return "Make sure your email includes an '@' and a domain (e.g., name@example.com).";
        } else return '';
    }
    if (label === 'Reenter Password') {
        if (password === '') {
            return 'Please enter your password first';
        }
        if (password !== value) {
            return 'Please re-enter your password';
        } else return '';
    }
}
