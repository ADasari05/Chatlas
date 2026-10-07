import React, { useEffect } from 'react';
import { deleteAllOwnWaypoints, handleMapLogin, handleMapLogout } from './Map';
import { createClient } from '@/utils/supabase/client';

interface AccountOption {
    id: string;
    label: string;
}

export let loginStatus = false;

export function setLoginStatus(status: boolean): void {
    loginStatus = status;
}

function Account(): React.JSX.Element {
    const [supabase] = React.useState(() => createClient());
    
    const accountLoginOptions: AccountOption[] = [
        { id: 'sign-in', label: 'Sign In' },
        { id: 'create-account', label: 'Create Account' },
    ];

    const accountOptions: AccountOption[] = [
        { id: 'account-settings', label: 'Account Settings' },
        { id: 'sign-out', label: 'Sign Out' },
    ];

    const [isMenuOpen, setIsMenuOpen] = React.useState<boolean>(false);
    const [isLoginPopupOpen, setIsLoginPopupOpen] = React.useState<boolean>(false);
    const [isAccountSettingsPopupOpen, setIsAccountSettingsPopupOpen] = React.useState<boolean>(false);
    const [isAccountDeletionPopupOpen, setIsAccountDeletionPopupOpen] = React.useState<boolean>(false);
    const [isAccountCreationPopupOpen, setIsAccountCreationPopupOpen] = React.useState<boolean>(false);
    const [showSignInSuccessPopup, setShowSignInSuccessPopup] = React.useState<boolean>(false);
    const [showSignOutSuccessPopup, setShowSignOutSuccessPopup] = React.useState<boolean>(false);
    const [accountCreationError, setAccountCreationError] = React.useState<string | null>(null);
    const [accountSignInError, setAccountSignInError] = React.useState<string | null>(null);
    const [accountDeletionError, setAccountDeletionError] = React.useState<string | null>(null);

    const [isLoggedIn, setIsLoggedIn] = React.useState<boolean>(false);
    const [email, setEmail] = React.useState<string>('');
    const [username, setUsername] = React.useState<string>('');
    const [password, setPassword] = React.useState<string>('');
    const [confirmPassword, setConfirmPassword] = React.useState<string>('');
    const [isLoading, setIsLoading] = React.useState<boolean>(false);

    const currentOptions = isLoggedIn ? accountOptions : accountLoginOptions;

    // Region states for account creation
    const [homeRegion, setHomeRegion] = React.useState<string>('');
    const [homeRegions, setHomeRegions] = React.useState<string[]>([]);
    const [regionSearch, setRegionSearch] = React.useState<string>('');
    const [isRegionOpen, setIsRegionOpen] = React.useState<boolean>(false);

    // States for account info change
    const [currentUsername, setCurrentUsername] = React.useState<string>('');
    const [currentRegion, setCurrentRegion] = React.useState<string>('');
    const [newUsername, setNewUsername] = React.useState<string>('');
    const [newRegion, setNewRegion] = React.useState<string>('');
    const [newRegionSearch, setNewRegionSearch] = React.useState<string>('');
    const [isNewRegionOpen, setIsNewRegionOpen] = React.useState<boolean>(false);
    const [usernameChangeError, setUsernameChangeError] = React.useState<string | null>(null);
    const [regionChangeError, setRegionChangeError] = React.useState<string | null>(null);
    const [isUsernameChangeLoading, setIsUsernameChangeLoading] = React.useState<boolean>(false);
    const [isRegionChangeLoading, setIsRegionChangeLoading] = React.useState<boolean>(false);

    const [isAccountInfoChangePopupOpen, setIsAccountInfoChangePopupOpen] = React.useState<boolean>(false);

    // Detect changes in the authentication state and update the login status accordingly
    useEffect(() => {
        const { data } = supabase.auth.onAuthStateChange((event, session) => {
            const signedIn = session !== null;
            setLoginStatus(signedIn);
            setIsLoggedIn(signedIn);
            if (event === 'SIGNED_OUT') {
                handleMapLogout();
            }
        });
 
        return () => data.subscription.unsubscribe();
    }, []);

    // Pull home regions when popup opens
    useEffect(() => {
        if (!isAccountCreationPopupOpen) {
            return;
        }
        supabase.rpc('get_home_regions').then(({ data }) => {
            if (data) {
                setHomeRegions(data);
            }
        });
    }, [isAccountCreationPopupOpen]);

    // Pull current user info when page opens
    useEffect(() => {
        if (!isAccountInfoChangePopupOpen) {
            return;
        }

        supabase.rpc('get_account_info').maybeSingle().then(({ data }) => {
            if (data) {
                setCurrentUsername(data.user_name ?? '');
                setCurrentRegion(data.home_region ?? '');
            }
        });

        if (homeRegions.length === 0) {
            supabase.rpc('get_home_regions').then(({ data }) => {
                if (data) {
                    setHomeRegions(data);
                }
            });
        }
    }, [isAccountInfoChangePopupOpen]);

    const resetForm = (): void => {
        setEmail('');
        setUsername('');
        setPassword('');
        setConfirmPassword('');
        setAccountSignInError(null);
        setAccountCreationError(null);
        setHomeRegion('');
        setRegionSearch('');
    };

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
        if (id === 'account-settings') {
            setIsAccountSettingsPopupOpen(true);
            console.log(`opening account settings popup`);
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

    const handleSignIn = async (): Promise<void> => {
        if(!email || !password) {
            setAccountSignInError('Please fill in all fields.');
            return;
        }
        setIsLoading(true);
        try {
            const [signInResult, statusResult] = await Promise.all([
                supabase.auth.signInWithPassword({ email, password }),
                supabase.rpc('get_email_status', { check_email: email }).maybeSingle(),
            ]);

            if (signInResult.error) {
                setAccountSignInError(signInResult.error.message);
                return;
            }

            if (statusResult.data?.disabled) {
                await supabase.auth.signOut();
                setAccountSignInError('This account is pending deletion and cannot be signed in to.');
                return;
            }

            resetForm();
            setLoginStatus(true);
            setIsLoginPopupOpen(false);
            openSignInSuccessPopup();
            handleMapLogin();
        } finally {
            setIsLoading(false);
        }
    };

    const handleAccountCreation = async (): Promise<void> => {
        if(!email || !username || !password || !confirmPassword || !homeRegion) {
            setAccountCreationError('Please fill in all fields.');
            return;
        }
        if (password !== confirmPassword) {
            setAccountCreationError('Passwords do not match.');
            return;
        }
 
       const [usernameTaken, emailStatus] = await Promise.all([
            supabase.rpc('is_display_name_taken', { check_name: username }),
            supabase.rpc('get_email_status', { check_email: email }).maybeSingle(),
        ]);

        if (usernameTaken.error || emailStatus.error) {
            setAccountCreationError('Could not verify account details. Please try again.');
            return;
        }
    
        if (emailStatus.data?.exists_already) {
            setAccountCreationError(
                emailStatus.data.disabled
                    ? 'This email belongs to an account pending deletion. Please use a different email.'
                    : 'This email is already registered.'
            );
            return;
        }

        if (usernameTaken.data) {
            setAccountCreationError('This username is already taken.');
            return;
        }

        setIsLoading(true);

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { display_name:username } },
        });

        if (error) {
            setIsLoading(false);
            setAccountCreationError(
                error.message.toLowerCase().includes('already registered')
                    ? 'This email is already registered.'
                    : error.message
            );
            return;
        }

        if (data.user) {
            const { error: insertError } = await supabase.from('UserData').insert({
                id: data.user.id,
                user_name: username,
                home_region: homeRegion,
            });
            if (insertError?.code === '23505') {
                setIsLoading(false);
                setAccountCreationError('This username is already taken.');
                return;
            }
        }

        setIsLoading(false);
        setAccountCreationError(null);

        if (data.session) {
            resetForm();
            setIsAccountCreationPopupOpen(false);
            openSignInSuccessPopup();
            handleMapLogin();
        }
    };

    const handleSignOut = async (): Promise<void> => {
        await supabase.auth.signOut();
        setIsMenuOpen(false);
        setIsAccountSettingsPopupOpen(false);
        openSignOutSuccessPopup();
        setLoginStatus(false);
        handleMapLogout();
    };

    const handleAccountDeletion = async (): Promise<void> => {
        setIsLoading(true);
        const { error } = await supabase.rpc('request_account_deletion');
        setIsLoading(false);

        if (error) {
            setAccountDeletionError('Could not process deletion request. Please try again.');
            return;
        }

        setIsAccountDeletionPopupOpen(false);
        await deleteAllOwnWaypoints();
        await handleSignOut();
    };

    const handleUsernameChange = async (): Promise<void> => {
        setUsernameChangeError(null);
        if (!newUsername) {
            setUsernameChangeError('Please enter a username.');
            return;
        }
        if (newUsername === currentUsername) {
            setUsernameChangeError('Same as old username. Please enter a new username.');
            return;
        }

        setIsUsernameChangeLoading(true);
        try {
            const { data: isTaken, error: checkError } = await supabase.rpc('is_display_name_taken', {
                check_name: newUsername,
            });

            if (checkError) {
                setUsernameChangeError('Could not verify username. Please try again.');
                return;
            }

            if (isTaken) {
                setUsernameChangeError('This username is already taken.');
                return;
            }

            const { error: authError } = await supabase.auth.updateUser({ data: { display_name: newUsername } });
            if (authError) {
                setUsernameChangeError(authError.message);
                return;
            }

            const { error: rpcError } = await supabase.rpc('update_username', { new_name: newUsername });
            if (rpcError) {
                setUsernameChangeError('Could not update username. Please try again.');
                return;
            }

            setCurrentUsername(newUsername);
            setNewUsername('');
        } finally {
            setIsUsernameChangeLoading(false);
        }
    };

    const handleRegionChange = async (): Promise<void> => {
        setRegionChangeError(null);
        if (!newRegion) {
            setRegionChangeError('Please choose a region.');
            return;
        }
        if (newRegion === currentRegion) {
            setRegionChangeError('Same as old region. Please enter a new region.');
            return;
        }

        setIsRegionChangeLoading(true);
        try {
            const { error } = await supabase.rpc('update_region', { new_region: newRegion });
            if (error) {
                setRegionChangeError('Could not update region. Please try again.');
                return;
            }

            setCurrentRegion(newRegion);
            setNewRegion('');
        } finally {
            setIsRegionChangeLoading(false);
        }
    };

    const handleCloseInfoChange = (): void => {
        setNewUsername('');
        setNewRegion('');
        setNewRegionSearch('');
        setUsernameChangeError(null);
        setRegionChangeError(null);
        setIsAccountInfoChangePopupOpen(false);
    }

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
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        {accountSignInError && (
                            <p className="error-message">{accountSignInError}</p>
                        )}
                        <button
                            className="sign-in-button"
                            onClick={handleSignIn}
                            disabled={isLoading}
                        >
                            Confirm
                        </button>
                        <button
                            className="close-button"
                            onClick={() => { resetForm(); setIsLoginPopupOpen(false); }}
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
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <input
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <input
                            type="password"
                            placeholder="Confirm Password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                        <div className="region-dropdown">
                            <input
                                type="text"
                                placeholder="Home Region"
                                value={isRegionOpen ? regionSearch : homeRegion}
                                onFocus={() => {
                                    setRegionSearch('');
                                    setIsRegionOpen(true);
                                }}
                                onChange={(e) => setRegionSearch(e.target.value)}
                                onBlur={() => {
                                    setIsRegionOpen(false);
                                }}
                            />
                            {isRegionOpen && (
                                <div className="region-dropdown-list">
                                    {homeRegions
                                        .filter((region) =>
                                            region.toLowerCase().includes(regionSearch.toLowerCase())
                                        )
                                        .map((region) => (
                                            <div
                                                key={region}
                                                className="region-dropdown-option"
                                                onMouseDown={() => {
                                                    setHomeRegion(region);
                                                    setIsRegionOpen(false);
                                                }}
                                            >
                                                {region}
                                            </div>
                                    ))}
                                    {homeRegions.filter((region) =>
                                        region.toLowerCase().includes(regionSearch.toLowerCase())
                                    ).length === 0 && (
                                        <div className="region-dropdown-empty">No matches</div>
                                    )}
                                </div>
                            )}
                        </div>
                        {accountCreationError && (
                            <p className="error-message">{accountCreationError}</p>
                        )}
                        <button
                            className="sign-in-button"
                            onClick={handleAccountCreation}
                            disabled={isLoading}
                        >
                            Confirm
                        </button>
                        <button
                            className="close-button"
                            onClick={() => { resetForm(); setIsAccountCreationPopupOpen(false); }}
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
            {isAccountSettingsPopupOpen && (
                <div className="settings-overlay">
                    <div className="settings-popup">
                        <button className="close-button" onClick={() => setIsAccountSettingsPopupOpen(false)}>Close</button>
                        <button className="account-info-change-button" onClick={() => { setIsAccountInfoChangePopupOpen(true); }}>
                            Change Account Info
                        </button>
                        <button className="delete-account-button" onClick={() => { setAccountDeletionError(null); setIsAccountDeletionPopupOpen(true); }}>
                            Delete Account
                        </button>
                    </div>
                </div>
            )
            }
            {isAccountDeletionPopupOpen && (
                <div className="deletion-popup">
                    <p>Are you sure you want to delete your account?</p>
                    {accountDeletionError && (
                        <p className="error-message">{accountDeletionError}</p>
                    )}
                    <button className="confirm-button" onClick={handleAccountDeletion} disabled={isLoading}>Confirm</button>
                    <button className="close-button" onClick={() => setIsAccountDeletionPopupOpen(false)}>Cancel</button>
                </div>
            )
            }
            {isAccountInfoChangePopupOpen && (
                <div className="sign-in-overlay">
                    <div className="sign-in-popup">
                        <button className="close-button" onClick={handleCloseInfoChange}>
                            Close
                        </button>

                        <p>Current Username: {currentUsername}</p>
                        <input
                            type="text"
                            placeholder="New username"
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
                        />
                        {usernameChangeError && <p className="error-message">{usernameChangeError}</p>}
                        <button onClick={handleUsernameChange} disabled={isUsernameChangeLoading} className="confirm-change-button">
                            Confirm
                        </button>

                        <p>Current Home Region: {currentRegion}</p>
                        <div className="region-dropdown">
                            <input
                                type="text"
                                placeholder="New home region"
                                value={isNewRegionOpen ? newRegionSearch : newRegion}
                                onFocus={() => {
                                    setNewRegionSearch('');
                                    setIsNewRegionOpen(true);
                                }}
                                onChange={(e) => setNewRegionSearch(e.target.value)}
                                onBlur={() => {
                                    setIsNewRegionOpen(false);
                                }}
                            />
                            {isNewRegionOpen && (
                                <div className="region-dropdown-list">
                                    {homeRegions
                                        .filter((region) => region.toLowerCase().includes(newRegionSearch.toLowerCase()))
                                        .map((region) => (
                                            <div
                                                key={region}
                                                className="region-dropdown-option"
                                                onMouseDown={() => {
                                                    setNewRegion(region);
                                                    setIsNewRegionOpen(false);
                                                }}
                                            >
                                                {region}
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                        {regionChangeError && <p className="error-message">{regionChangeError}</p>}
                        <button onClick={handleRegionChange} disabled={isRegionChangeLoading} className="confirm-change-button">
                            Confirm
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Account;