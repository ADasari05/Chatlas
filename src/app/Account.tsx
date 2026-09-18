import React, { useEffect } from 'react';

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
    const [showSignInSuccessPopup, setShowSignInSuccessPopup] = React.useState<boolean>(false);
    const [showSignOutSuccessPopup, setShowSignOutSuccessPopup] = React.useState<boolean>(false);
    const [accountCreationError, setAccountCreationError] = React.useState<string | null>(null);
    const [accountSignInError, setAccountSignInError] = React.useState<string | null>(null);

    const currentOptions = loginStatus ? accountOptions : accountLoginOptions;

    const handleInputSelection = (): void => {
        setAccountSignInError(null);
        setAccountCreationError(null);
    }

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

    const openSignInSuccessPopup = (): void => {
        setShowSignInSuccessPopup(true);
    }

    const openSignOutSuccessPopup = (): void => {
        setShowSignOutSuccessPopup(true);
    }

    useEffect(() => {
        if (showSignInSuccessPopup) {
            const timer = setTimeout(() => {
                setShowSignInSuccessPopup(false);
            }, 2500);
        }
    }, [showSignInSuccessPopup]);

    useEffect(() => {
        if (showSignOutSuccessPopup) {
            const timer = setTimeout(() => {
                setShowSignOutSuccessPopup(false);
            }, 2500);
        }
    }, [showSignOutSuccessPopup]);

    const handleSignIn = (): void => {
        //TODO: server validation
        if (1 != 1) {
            setAccountSignInError("Invalid email or password");
            return;
        }
        else {
            setAccountSignInError(null);
        }
        setLoginStatus(true);
        setIsLoginPopupOpen(false);
        openSignInSuccessPopup();
    };

    const handleAccountCreation = (): void => {
        //TODO: server validation
        setLoginStatus(true);
        setIsAccountCreationPopupOpen(false);
        openSignInSuccessPopup();
    };

    const handleSignOut = (): void => {
        //TODO: server validation
        setLoginStatus(false);
        setIsMenuOpen(false);
        openSignOutSuccessPopup();
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
                        {accountSignInError && (
                            <p className="error-message">{accountSignInError}</p>
                        )}
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
                        {accountCreationError && (
                            <p className="error-message">{accountCreationError}</p>
                        )}
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
            {showSignInSuccessPopup && (
                <div className="success-popup">
                    <p>Sign-in successful!</p>
                </div>
            )
            }
            {showSignOutSuccessPopup && (
                <div className="success-popup">
                    <p>Sign-out successful!</p>
                </div>
            )
            }
        </div>
    );
}

export default Account;