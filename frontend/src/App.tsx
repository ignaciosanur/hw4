import { Route, Routes } from 'react-router-dom'
import AnnouncementBar from './components/AnnouncementBar'
import NavBar from './components/NavBar'
import Footer from './components/Footer'
import ChatPanel from './components/ChatPanel'
import Home from './pages/Home'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import About from './pages/About'
import Auth from './pages/Auth'
import ResetPassword from './pages/ResetPassword'

export default function App() {
  return (
    <>
      <AnnouncementBar />
      <NavBar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:productId" element={<ProductDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Auth mode="login" />} />
          <Route path="/signup" element={<Auth mode="signup" />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="*"
            element={
              <div className="wrap page">
                <h1>Page not found</h1>
                <p>That page does not exist. Try the <a href="/products">catalogue</a>.</p>
              </div>
            }
          />
        </Routes>
      </main>
      <Footer />
      <ChatPanel />
    </>
  )
}
