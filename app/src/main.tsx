import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ParityScreen } from './components/ParityScreen';
import './index.css';

// ?parite=1 → diferansiyel test paneli (KÖ-14); aksi hâlde oyun
const parity = new URLSearchParams(window.location.search).has('parite');
createRoot(document.getElementById('root')!).render(parity ? <ParityScreen /> : <App />);
