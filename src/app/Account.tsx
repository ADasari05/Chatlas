import React from 'react';

interface AccountOption {
    id: string;
    label: string;
}

function Account(): React.JSX.Element {
    const accountLoginOptions: AccountOption[] = [
        { id: 'sign-in', label: 'Sign In' },
        { id: 'create-account', label: 'Create Account' },
    ];

    const accountOptions: AccountOption[] = [
        { id: 'account-settings', label: 'Account Settings' },
        { id: 'sign-out', label: 'Sign Out' },
    ];

    const [loginStatus, setLoginStatus] = React.useState<boolean>(false);
    const [isMenuOpen, setIsMenuOpen] = React.useState<boolean>(false);
    const [isLoginPopupOpen, setIsLoginPopupOpen] = React.useState<boolean>(false);
    const [isAccountCreationPopupOpen, setIsAccountCreationPopupOpen] = React.useState<boolean>(false);

    const currentOptions = loginStatus ? accountOptions : accountLoginOptions;

    const handleButtonClick = (label: string, id: string): void => {
        console.log(`Clicked: ${id} button`);
        setIsMenuOpen(false);
        if (id === 'sign-in') {
            setIsLoginPopupOpen(true);
            console.log(`opening login popup`);
        }
        if (id === 'create-account') {
            setIsAccountCreationPopupOpen(true);
            console.log(`opening account creation popup`);
        }
        if (id === 'sign-out') {
            handleSignOut();
            console.log(`signing out`);
        }
    };

    const handleSignIn = (): void => {
        setLoginStatus(true);
        setIsLoginPopupOpen(false);
    };

    const handleAccountCreation = (): void => {
        setLoginStatus(true);
        setIsAccountCreationPopupOpen(false);
    };

    const handleSignOut = (): void => {
        setLoginStatus(false);
        setIsMenuOpen(false);
    };

    return (
        <div className="account-icon"
            onMouseEnter={() => setIsMenuOpen(true)}
            onMouseLeave={() => setIsMenuOpen(false)}
        >
            <button className="account-button">
                <svg
                    viewBox="0 0 24 24"
                    fill="#a3a3a3"
                    style={{ width: '65%', height: '65%' }}
                >
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
            </button>
            {isMenuOpen && (
                <div className="account-dropdown">
                    {currentOptions.map((option) => (
                        <button
                            key={option.id}
                            className="dropdown-item"
                            onClick={() => handleButtonClick(option.label, option.id)}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
            {isLoginPopupOpen && (
                <div className="sign-in-overlay">
                    <div className="sign-in-popup">
                        <h2>Sign In</h2>
                        <input
                            type="text"
                            placeholder="Email"
                        />
                        <input
                            type="password"
                            placeholder="Password"
                        />
                        <button
                            className="sign-in-button"
                            onClick={handleSignIn}
                        >
                            Confirm
                        </button>
                        <button
                            className="close-button"
                            onClick={() => setIsLoginPopupOpen(false)}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
            {isAccountCreationPopupOpen && (
                <div className="sign-in-overlay">
                    <div className="sign-in-popup">
                        <h2>Create Account</h2>
                        <input
                            type="text"
                            placeholder="Email"
                        />
                        <input
                            type="text"
                            placeholder="Username"
                        />
                        <input
                            type="password"
                            placeholder="Password"
                        />
                        <input
                            type="password"
                            placeholder="Confirm Password"
                        />
                        <button
                            className="sign-in-button"
                            onClick={handleAccountCreation}
                        >
                            Confirm
                        </button>
                        <button
                            className="close-button"
                            onClick={() => setIsAccountCreationPopupOpen(false)}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Account;