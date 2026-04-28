"use client"

import { Star, ShoppingCart, Heart, Search, Menu, ChevronRight, Sparkles } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group"
import { UserChatHead } from "@/components/chat/user-chat-head"

const products = [
  {
    id: 1,
    name: "Premium Wireless Headphones",
    price: 299.99,
    rating: 4.8,
    reviews: 234,
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop",
  },
  {
    id: 2,
    name: "Smart Fitness Watch",
    price: 199.99,
    rating: 4.6,
    reviews: 156,
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop",
  },
  {
    id: 3,
    name: "Portable Bluetooth Speaker",
    price: 79.99,
    rating: 4.7,
    reviews: 89,
    image: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&h=400&fit=crop",
  },
  {
    id: 4,
    name: "Minimalist Desk Lamp",
    price: 59.99,
    rating: 4.5,
    reviews: 67,
    image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400&h=400&fit=crop",
  },
]

export default function UserStorePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
            <Link href="/user" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold text-foreground">Store</span>
            </Link>
            <nav className="hidden items-center gap-6 md:flex">
              <Link href="#" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                Products
              </Link>
              <Link href="#" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                Categories
              </Link>
              <Link href="#" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                Deals
              </Link>
              <Link href="#" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                About
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden w-64 md:block">
              <InputGroup>
                <InputGroupAddon>
                  <Search className="h-4 w-4 text-muted-foreground" />
                </InputGroupAddon>
                <InputGroupInput placeholder="Search products..." className="bg-muted border-0" />
              </InputGroup>
            </div>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Heart className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
              <ShoppingCart className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                2
              </span>
            </Button>
            <img
              src="https://i.pravatar.cc/150?u=currentuser"
              alt="User"
              className="h-8 w-8 rounded-full"
            />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-2xl">
            <span className="mb-4 inline-block rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              New Collection
            </span>
            <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
              <span className="text-balance">Discover Premium Products</span>
            </h1>
            <p className="mb-8 text-lg text-muted-foreground">
              Explore our curated selection of high-quality items designed to enhance your everyday life.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg">
                Shop Now
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline">
                View Catalog
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="container mx-auto px-4 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Featured Products</h2>
            <p className="text-muted-foreground">Hand-picked items just for you</p>
          </div>
          <Button variant="ghost" className="text-primary">
            View All
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <Card key={product.id} className="group overflow-hidden">
              <div className="relative aspect-square overflow-hidden">
                <img
                  src={product.image}
                  alt={product.name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2 h-8 w-8 bg-card/80 text-muted-foreground opacity-0 backdrop-blur transition-opacity hover:bg-card hover:text-destructive group-hover:opacity-100"
                >
                  <Heart className="h-4 w-4" />
                </Button>
              </div>
              <CardContent className="p-4">
                <h3 className="mb-1 font-medium text-foreground line-clamp-1">{product.name}</h3>
                <div className="mb-2 flex items-center gap-1">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="text-sm text-foreground">{product.rating}</span>
                  <span className="text-sm text-muted-foreground">({product.reviews})</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-foreground">${product.price}</span>
                  <Button size="sm">Add to Cart</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/30">
        <div className="container mx-auto px-4 py-12">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: "Free Shipping", desc: "On orders over $50" },
              { title: "24/7 Support", desc: "Chat with our team anytime" },
              { title: "Easy Returns", desc: "30-day money back" },
              { title: "Secure Payment", desc: "SSL encrypted checkout" },
            ].map((feature, i) => (
              <div key={i} className="text-center">
                <h3 className="mb-1 font-semibold text-foreground">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* User chat head - floating contact support button */}
      <UserChatHead />
    </div>
  )
}
