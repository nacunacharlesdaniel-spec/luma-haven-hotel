import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import {
    ArrowRight,
    BedDouble,
    CalendarDays,
    Check,
    ChevronDown,
    Clock3,
    Gift,
    LogIn,
    LogOut,
    Menu,
    Sparkles,
    UserRound,
    X,
} from 'lucide-react';
import { supabase, configured } from './lib/supabase';
import './styles.css';

const fallback = [
    {
        id: 1,
        name: 'Garden Deluxe',
        type: 'Deluxe Room',
        description:
            'A calm modern room with a garden-facing view, queen bed and private balcony.',
        image_url:
            'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=85',
        size: '32 m²',
        price_label: 'FREE ONE NIGHT',
        is_free_night: true,
    },
    {
        id: 2,
        name: 'Ocean Premier',
        type: 'Premier Room',
        description:
            'Bright coastal-inspired accommodation with a king bed and panoramic view.',
        image_url:
            'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=85',
        size: '40 m²',
        price_label: 'FROM ₱4,800 / NIGHT',
        is_free_night: false,
    },
    {
        id: 3,
        name: 'Family Residence',
        type: 'Family Suite',
        description:
            'A spacious suite designed for families with two beds and a sitting area.',
        image_url:
            'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&q=85',
        size: '58 m²',
        price_label: 'FROM ₱7,200 / NIGHT',
        is_free_night: false,
    },
];

function App() {
    const [rooms, setRooms] = useState(fallback);

    const [user, setUser] = useState(() =>
        JSON.parse(localStorage.getItem('luma_user') || 'null')
    );

    const [reservations, setReservations] = useState([]);
    const [modal, setModal] = useState(null);
    const [mode, setMode] = useState('login');
    const [pending, setPending] = useState(null);
    const [toast, setToast] = useState('');
    const [menu, setMenu] = useState(false);

    useEffect(() => {
        if (configured) {
            supabase
                .from('rooms')
                .select('*')
                .order('id')
                .then(({ data }) => {
                    if (data?.length) {
                        setRooms(data);
                    }
                });
        }
    }, []);

    useEffect(() => {
        if (user) {
            loadReservations();
        } else {
            setReservations([]);
        }
    }, [user]);

    async function loadReservations() {
        if (!configured || !user) return;

        const { data } = await supabase
            .from('reservations')
            .select('*,rooms(*)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        setReservations(data || []);
    }

    function note(x) {
        setToast(x);

        setTimeout(() => {
            setToast('');
        }, 3000);
    }

    function claim(room) {
        setPending(room);

        if (!user) {
            setMode('login');
            setModal('auth');
        } else {
            reserve(room);
        }
    }

    async function reserve(room) {
        const d = new Date();

        d.setDate(d.getDate() + 7);

        const out = new Date(d);

        out.setDate(out.getDate() + 1);

        const payload = {
            user_id: user.id,
            room_id: room.id,
            check_in: d.toISOString().slice(0, 10),
            check_out: out.toISOString().slice(0, 10),
            status: 'Confirmed',
        };

        if (configured) {
            const { error } = await supabase
                .from('reservations')
                .insert(payload);

            if (error) {
                note(
                    error.code === '23505'
                        ? 'This room is already reserved for this account.'
                        : error.message
                );

                return;
            }

            await loadReservations();
        } else {
            const all = JSON.parse(
                localStorage.getItem('luma_res') || '[]'
            );

            if (
                all.some(
                    (x) =>
                        x.user_id === user.id &&
                        x.room_id === room.id
                )
            ) {
                note('This room is already reserved for this account.');
                return;
            }

            all.unshift({
                ...payload,
                id: Date.now(),
                rooms: room,
            });

            localStorage.setItem(
                'luma_res',
                JSON.stringify(all)
            );

            setReservations(
                all.filter((x) => x.user_id === user.id)
            );
        }

        note('Your free one-night stay is reserved!');
        setPending(null);
    }

    async function auth(e) {
        e.preventDefault();

        const f = new FormData(e.currentTarget);

        const username = f.get('username').trim();
        const password = f.get('password');

        if (
            username.length < 3 ||
            password.length < 4
        ) {
            return note(
                'Username must be 3+ characters and password 4+ characters.'
            );
        }

        let account;

        if (!configured) {
            const users = JSON.parse(
                localStorage.getItem('luma_users') || '[]'
            );

            if (mode === 'signup') {
                if (
                    users.some(
                        (x) =>
                            x.username.toLowerCase() ===
                            username.toLowerCase()
                    )
                ) {
                    return note('Username already exists.');
                }

                account = {
                    id: Date.now(),
                    username,
                    password,
                };

                localStorage.setItem(
                    'luma_users',
                    JSON.stringify([...users, account])
                );
            } else {
                account = users.find(
                    (x) =>
                        x.username === username &&
                        x.password === password
                );

                if (!account) {
                    return note('Invalid username or password.');
                }
            }
        } else if (mode === 'signup') {
            const { data: old } = await supabase
                .from('users')
                .select('id')
                .eq('username', username)
                .maybeSingle();

            if (old) {
                return note('Username already exists.');
            }

            const { data, error } = await supabase
                .from('users')
                .insert({
                    username,
                    password,
                })
                .select()
                .single();

            if (error) {
                return note(error.message);
            }

            account = data;
        } else {
            const { data, error } = await supabase
                .from('users')
                .select('id,username')
                .eq('username', username)
                .eq('password', password)
                .maybeSingle();

            if (error) {
                return note(error.message);
            }

            if (!data) {
                return note('Invalid username or password.');
            }

            account = data;
        }

        setUser(account);

        localStorage.setItem(
            'luma_user',
            JSON.stringify(account)
        );

        setModal(null);

        note(`Welcome, ${account.username}!`);

        if (pending) {
            setTimeout(() => reserve(pending), 100);
        }
    }

    function logout() {
        setUser(null);

        localStorage.removeItem('luma_user');

        setModal(null);

        note('Signed out.');
    }

    function go(id) {
        document
            .getElementById(id)
            ?.scrollIntoView({
                behavior: 'smooth',
            });

        setMenu(false);
    } return (
        <div className="app">
            {toast && (
                <div className="toast">
                    <Check size={16} />
                    {toast}
                </div>
            )}

            <header>
                <button
                    className="brand"
                    onClick={() => go('home')}
                >
                    <span>
                        <Sparkles />
                    </span>

                    <b>
                        LUMA
                        <small>HAVEN HOTEL</small>
                    </b>
                </button>

                <nav className={menu ? 'open' : ''}>
                    <button onClick={() => go('home')}>
                        Home
                    </button>

                    <button onClick={() => go('rooms')}>
                        Rooms
                    </button>

                    <button onClick={() => go('offer')}>
                        Free Night
                    </button>

                    <button onClick={() => go('amenities')}>
                        Amenities
                    </button>

                    <button onClick={() => go('faq')}>
                        FAQ
                    </button>
                </nav>

                <div className="actions">
                    {user ? (
                        <button
                            onClick={() => setModal('account')}
                            className="user"
                        >
                            <UserRound size={16} />
                            {user.username}
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                setMode('login');
                                setModal('auth');
                            }}
                            className="login"
                        >
                            <LogIn size={16} />
                            Sign in
                        </button>
                    )}

                    <button
                        className="hamb"
                        onClick={() => setMenu(!menu)}
                    >
                        {menu ? <X /> : <Menu />}
                    </button>
                </div>
            </header>

            <section id="home" className="hero">
                <div className="shade" />

                <div className="heroText">
                    <label>✦ A QUIET PLACE TO ARRIVE</label>

                    <h1>
                        Stay somewhere
                        <br />
                        <i>worth remembering.</i>
                    </h1>

                    <p>
                        Thoughtful rooms, warm service, and a little
                        more time to slow down. Discover your next
                        comfortable escape at Luma Haven.
                    </p>

                    <div>
                        <button
                            className="primary"
                            onClick={() => go('rooms')}
                        >
                            Explore rooms
                            <ArrowRight size={17} />
                        </button>

                        <button
                            className="outline"
                            onClick={() => go('offer')}
                        >
                            View free-night offer
                        </button>
                    </div>
                </div>
            </section>

            <div className="trust">
                <span>
                    <Sparkles />
                    <b>4.9/5</b> guest experience
                </span>

                <span>
                    <Check />
                    <b>Simple</b> reservations
                </span>

                <span>
                    <Clock3 />
                    <b>24/7</b> service concept
                </span>
            </div>

            <section id="rooms" className="section">
                <div className="head">
                    <div>
                        <label>OUR ROOMS</label>

                        <h2>
                            Comfort, with room
                            <br />
                            <i>to breathe.</i>
                        </h2>
                    </div>

                    <p>
                        Explore rooms designed around simple
                        comforts, natural textures, and restful stays.
                    </p>
                </div>

                <div className="grid">
                    {rooms.map((r) => (
                        <article
                            className="room"
                            key={r.id}
                        >
                            <div className="pic">
                                <img
                                    src={r.image_url}
                                    alt={r.name}
                                />

                                {r.is_free_night && (
                                    <em>
                                        <Gift size={13} />
                                        FREE NIGHT
                                    </em>
                                )}
                            </div>

                            <div className="body">
                                <small>
                                    {r.type} · {r.size}
                                </small>

                                <h3>{r.name}</h3>

                                <p>{r.description}</p>

                                <div className="bottom">
                                    <strong>
                                        {r.price_label}
                                    </strong>

                                    <button
                                        onClick={() =>
                                            r.is_free_night
                                                ? claim(r)
                                                : note(
                                                    'This room is available for browsing in the demo.'
                                                )
                                        }
                                    >
                                        {r.is_free_night
                                            ? 'Claim offer'
                                            : 'View room'}

                                        <ArrowRight size={15} />
                                    </button>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            <section id="offer" className="offer">
                <div className="offerText">
                    <label>LIMITED DEMO OFFER</label>

                    <h2>
                        One night.
                        <br />
                        <i>On us.</i>
                    </h2>

                    <p>
                        New guests can claim a complimentary
                        one-night stay in our Garden Deluxe room.
                        Create an account to reserve the offer.
                    </p>

                    <ul>
                        <li>
                            <Check />
                            One complimentary night
                        </li>

                        <li>
                            <Check />
                            Garden Deluxe accommodation
                        </li>

                        <li>
                            <Check />
                            Reservation stored to your account
                        </li>
                    </ul>

                    <button
                        className="primary gold"
                        onClick={() =>
                            claim(
                                rooms.find(
                                    (r) => r.is_free_night
                                ) || rooms[0]
                            )
                        }
                    >
                        Claim free night
                        <ArrowRight size={17} />
                    </button>
                </div>

                <img
                    src={
                        (
                            rooms.find(
                                (r) => r.is_free_night
                            ) || rooms[0]
                        ).image_url
                    }
                    alt="Garden Deluxe"
                />
            </section>

            <section
                id="amenities"
                className="section soft"
            >
                <div className="center">
                    <label>THE LUMA EXPERIENCE</label>

                    <h2>
                        Little details.
                        <br />
                        <i>Longer exhale.</i>
                    </h2>
                </div>

                <div className="amenities">
                    <div>
                        <BedDouble />

                        <h3>Restful rooms</h3>

                        <p>
                            Soft bedding, calm lighting, and
                            considered spaces.
                        </p>
                    </div>

                    <div>
                        <Sparkles />

                        <h3>Clean & simple</h3>

                        <p>
                            A fresh atmosphere designed to help
                            you settle in.
                        </p>
                    </div>

                    <div>
                        <UserRound />

                        <h3>Warm service</h3>

                        <p>
                            A friendly hotel concept centered on
                            welcoming service.
                        </p>
                    </div>
                </div>
            </section>

            <section id="faq" className="faq">
                <div>
                    <label>QUESTIONS</label>

                    <h2>Good to know.</h2>

                    <p>
                        A few quick answers about the free-night
                        demonstration.
                    </p>
                </div>

                <div>
                    {[
                        [
                            'Do I need an account to claim the free night?',
                            'Yes. You can browse freely, but selecting the free-night offer opens the sign-in/sign-up flow first.',
                        ],
                        [
                            'Can different accounts claim the same room?',
                            'Yes. Reservations belong to the user account, so different demonstration accounts can independently claim the same offer.',
                        ],
                        [
                            'Where are reservations stored?',
                            'With Supabase configured, account and reservation records are stored in the Supabase database.',
                        ],
                        [
                            'Is this a real hotel booking system?',
                            'No. This is a school demonstration and does not process real bookings, payments, or hotel inventory.',
                        ],
                    ].map(([q, a]) => (
                        <details key={q}>
                            <summary>
                                {q}
                                <ChevronDown />
                            </summary>

                            <p>{a}</p>
                        </details>
                    ))}
                </div>
            </section>

            <footer>
                <b>✦ LUMA HAVEN</b>

                <span>
                    © 2026 School demonstration project.
                </span>

                <button onClick={() => go('home')}>
                    Back to top ↑
                </button>
            </footer>
            {modal === 'auth' && (
                <div className="back">
                    <div className="modal">
                        <button
                            className="close"
                            onClick={() => setModal(null)}
                        >
                            <X />
                        </button>

                        <div className="icon">
                            <Sparkles />
                        </div>

                        <label>LUMA HAVEN</label>

                        <h2>
                            {mode === 'login'
                                ? 'Welcome back.'
                                : 'Create your stay account.'}
                        </h2>

                        <p>
                            {mode === 'login'
                                ? 'Sign in to continue with your reservation.'
                                : 'Create a simple account for this demonstration.'}
                        </p>

                        <form onSubmit={auth}>
                            <input
                                name="username"
                                placeholder="Username"
                                autoComplete="username"
                                required
                            />

                            <input
                                name="password"
                                type="password"
                                placeholder="Password"
                                autoComplete={
                                    mode === 'login'
                                        ? 'current-password'
                                        : 'new-password'
                                }
                                required
                            />

                            <button className="primary full">
                                {mode === 'login'
                                    ? 'Sign in'
                                    : 'Create account'}

                                <ArrowRight size={16} />
                            </button>
                        </form>

                        <button
                            className="switch"
                            onClick={() =>
                                setMode(
                                    mode === 'login'
                                        ? 'signup'
                                        : 'login'
                                )
                            }
                        >
                            {mode === 'login'
                                ? 'Need an account? Sign up'
                                : 'Already have an account? Sign in'}
                        </button>

                        <small>
                            School demonstration authentication.
                            Do not use a real password.
                        </small>
                    </div>
                </div>
            )}

            {modal === 'account' && (
                <div className="back">
                    <div className="modal account">
                        <button
                            className="close"
                            onClick={() => setModal(null)}
                        >
                            <X />
                        </button>

                        <div className="accountHead">
                            <div className="avatar">
                                <UserRound />
                            </div>

                            <div>
                                <small>Signed in as</small>

                                <h2>{user.username}</h2>
                            </div>
                        </div>

                        <h3>
                            <CalendarDays size={17} />
                            My reservations
                        </h3>

                        {reservations.length ? (
                            reservations.map((r) => (
                                <div
                                    className="reservation"
                                    key={r.id}
                                >
                                    <img
                                        src={
                                            r.rooms?.image_url ||
                                            fallback[0].image_url
                                        }
                                        alt=""
                                    />

                                    <div>
                                        <b>
                                            {r.rooms?.name ||
                                                'Hotel room'}
                                        </b>

                                        <span>
                                            {r.check_in} → {r.check_out}
                                        </span>

                                        <small>
                                            <Check size={12} />
                                            {r.status}
                                        </small>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="empty">
                                No reservations yet.
                            </p>
                        )}

                        <button
                            className="logout"
                            onClick={logout}
                        >
                            <LogOut size={15} />
                            Sign out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

ReactDOM.createRoot(
    document.getElementById('root')
).render(<App />);