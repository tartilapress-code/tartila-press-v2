// Application Assets save in .assets folder (img, svg)
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import HomeLayout from './layouts/HomeLayout';
import HomePage from './pages/Home/HomePage';
import './styles/App.css';
import 'remixicon/fonts/remixicon.css';
import LayananPage from './pages/Home/LayananPage';

const router = createBrowserRouter([
    {
        path: '',
        element: <HomeLayout />,
        children: [
            { path: '/', element: <HomePage /> },
            { path: 'layanan', element: <LayananPage /> },
        ],
    },
]);

function App() {
    return (
        <>
            <RouterProvider router={router} />
        </>
    );
}

export default App;
