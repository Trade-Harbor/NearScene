import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { useLocation as useLocationContext } from '../context/LocationContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { 
  MessageSquare, 
  HelpCircle, 
  Users, 
  Newspaper, 
  AlertTriangle, 
  Tag, 
  ThumbsUp,
  ThumbsDown,
  Search,
  Plus,
  MapPin,
  Clock,
  ChevronUp,
  ChevronDown,
  MessageCircle,
  Flag,
  Send,
  X,
  Loader2,
  Award,
  Trophy,
  Sparkles
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CATEGORIES = [
  { value: 'general', label: 'General', icon: MessageSquare },
  { value: 'questions', label: 'Questions', icon: HelpCircle },
  { value: 'meetups', label: 'Meetups', icon: Users },
  { value: 'news', label: 'Local News', icon: Newspaper },
  { value: 'alerts', label: 'Alerts', icon: AlertTriangle },
  { value: 'for_sale', label: 'For Sale / Free', icon: Tag },
  { value: 'recommendations', label: 'Recommendations', icon: ThumbsUp },
];

export default function CommunityPage() {
  const navigate = useNavigate();
  const { location } = useLocationContext();
  const { user, isAuthenticated, token } = useAuth();
  
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [localOnly, setLocalOnly] = useState(false);
  const [showNewPost, setShowNewPost] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [newsItems, setNewsItems] = useState([]);

  useEffect(() => {
    fetchPosts();
    fetchLeaderboard();
    fetchNews();
    if (isAuthenticated) {
      fetchUserStats();
    }
  }, [selectedCategory, localOnly, isAuthenticated]);

  const fetchNews = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/news`, { params: { limit: 8 } });
      setNewsItems(response.data || []);
    } catch (error) {
      console.error('Error fetching news:', error);
    }
  };

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const params = {
        latitude: location?.latitude,
        longitude: location?.longitude,
        radius: 25,
        limit: 50,
        local_only: localOnly
      };

      if (selectedCategory && selectedCategory !== 'all') {
        params.category = selectedCategory;
      }
      if (searchQuery) {
        params.search = searchQuery;
      }

      const response = await axios.get(`${API_URL}/api/community/posts`, { params });
      setPosts(response.data);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/gamification/leaderboard?limit=5`);
      setLeaderboard(response.data);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
  };

  const fetchUserStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/gamification/my-stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserStats(response.data);
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchPosts();
  };

  const handleVote = async (postId, voteType) => {
    if (!isAuthenticated) {
      toast.error('Please login to vote');
      return;
    }

    try {
      await axios.post(
        `${API_URL}/api/community/posts/${postId}/vote?vote_type=${voteType}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchPosts();
    } catch (error) {
      toast.error('Failed to vote');
    }
  };

  return (
    <div className="min-h-screen bg-background" data-testid="community-page">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-500 to-purple-500 text-white">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl py-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Users className="h-6 w-6" />
            </div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold">Community</h1>
          </div>
          <p className="text-white/80 max-w-2xl">
            Connect with your neighbors, share local news, and organize meetups.
          </p>
        </div>
      </div>

      {/* Local News Strip */}
      {newsItems.length > 0 && (
        <div className="border-b border-border bg-muted/30">
          <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl py-6">
            <div className="flex items-center gap-2 mb-4">
              <Newspaper className="h-5 w-5 text-violet-500" />
              <h2 className="font-heading text-xl font-semibold">Local News</h2>
              <Badge variant="secondary" className="text-xs">via Google News</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {newsItems.slice(0, 4).map((item) => (
                <a
                  key={item.news_id || item.link}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 bg-card rounded-xl border border-border hover:border-violet-500/50 hover:shadow-md transition-all"
                  data-testid={`news-${item.news_id || ''}`}
                >
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <span className="font-medium truncate">{item.source}</span>
                    {item.published_at && (
                      <>
                        <span>·</span>
                        <span>{formatDistanceToNow(new Date(item.published_at), { addSuffix: true })}</span>
                      </>
                    )}
                  </p>
                  <h3 className="font-medium text-sm line-clamp-3 group-hover:text-violet-600">{item.title}</h3>
                </a>
              ))}
            </div>
            {newsItems.length > 4 && (
              <details className="mt-4">
                <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                  Show {newsItems.length - 4} more headlines
                </summary>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                  {newsItems.slice(4).map((item) => (
                    <a
                      key={item.news_id || item.link}
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-4 bg-card rounded-xl border border-border hover:border-violet-500/50 hover:shadow-md transition-all"
                    >
                      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                        <span className="font-medium truncate">{item.source}</span>
                        {item.published_at && (
                          <>
                            <span>·</span>
                            <span>{formatDistanceToNow(new Date(item.published_at), { addSuffix: true })}</span>
                          </>
                        )}
                      </p>
                      <h3 className="font-medium text-sm line-clamp-3">{item.title}</h3>
                    </a>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 md:px-6 lg:px-8 max-w-7xl py-8">
        {/* When the 'Local News' category is selected, render the full news feed
            instead of forum posts (which are user-submitted and category=news
            rarely populated). Keeps the existing top-strip widget too. */}
        {selectedCategory === 'news' && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Newspaper className="h-5 w-5 text-violet-500" />
                <h2 className="font-heading text-2xl font-semibold">Wilmington Local News</h2>
              </div>
              <Badge variant="secondary">via Google News · refreshed daily</Badge>
            </div>
            {newsItems.length === 0 ? (
              <div className="text-center py-12 bg-muted/30 rounded-xl">
                <Newspaper className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No news items yet — check back after the next ingestion.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {newsItems.map((item) => (
                  <a
                    key={item.news_id || item.link}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-5 bg-card rounded-xl border border-border hover:border-violet-500/50 hover:shadow-md transition-all"
                  >
                    <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      <span className="font-medium truncate">{item.source}</span>
                      {item.published_at && (
                        <>
                          <span>·</span>
                          <span>{formatDistanceToNow(new Date(item.published_at), { addSuffix: true })}</span>
                        </>
                      )}
                    </p>
                    <h3 className="font-medium text-base line-clamp-3 mb-2">{item.title}</h3>
                    {item.summary && (
                      <p className="text-sm text-muted-foreground line-clamp-3">{item.summary}</p>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <form onSubmit={handleSearch} className="flex-1 min-w-[200px] max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search discussions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 rounded-full"
                    data-testid="search-input"
                  />
                </div>
              </form>

              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[150px] rounded-full" data-testid="category-select">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Topics</SelectItem>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant={localOnly ? 'default' : 'outline'}
                onClick={() => setLocalOnly(!localOnly)}
                className="rounded-full gap-2"
                data-testid="local-only-btn"
              >
                <MapPin className="h-4 w-4" />
                Near Me
              </Button>

              {isAuthenticated && (
                <Button
                  onClick={() => setShowNewPost(true)}
                  className="rounded-full bg-gradient-to-r from-violet-500 to-purple-500 hover:opacity-90 ml-auto"
                  data-testid="new-post-btn"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Post
                </Button>
              )}
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap gap-2 mb-6">
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('all')}
                className="rounded-full"
              >
                All
              </Button>
              {CATEGORIES.map((cat) => (
                <Button
                  key={cat.value}
                  variant={selectedCategory === cat.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(cat.value)}
                  className="rounded-full gap-1"
                >
                  <cat.icon className="h-3 w-3" />
                  {cat.label}
                </Button>
              ))}
            </div>

            {/* Posts */}
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-32 bg-muted rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : posts.length > 0 ? (
              <div className="space-y-4">
                {posts.map((post) => (
                  <PostCard 
                    key={post.post_id} 
                    post={post} 
                    onVote={handleVote}
                    isAuthenticated={isAuthenticated}
                    token={token}
                    onRefresh={fetchPosts}
                  />
                ))}
              </div>
            ) : (
              <Card className="dark:border-white/10">
                <CardContent className="p-12 text-center">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No discussions yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Be the first to start a conversation in your community!
                  </p>
                  {isAuthenticated && (
                    <Button onClick={() => setShowNewPost(true)} className="rounded-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Start Discussion
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* User Stats */}
            {userStats && (
              <Card className="dark:border-white/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Award className="h-4 w-4 text-primary" />
                    Your Progress
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/10 rounded-xl">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{userStats.total_points} points</p>
                      <p className="text-xs text-muted-foreground">Level {userStats.level} - {userStats.level_name}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center text-sm">
                    <div className="p-2 bg-muted rounded-lg">
                      <p className="font-semibold">{userStats.events_attended}</p>
                      <p className="text-xs text-muted-foreground">Events</p>
                    </div>
                    <div className="p-2 bg-muted rounded-lg">
                      <p className="font-semibold">{userStats.reviews_posted}</p>
                      <p className="text-xs text-muted-foreground">Reviews</p>
                    </div>
                    <div className="p-2 bg-muted rounded-lg">
                      <p className="font-semibold">{userStats.forum_posts}</p>
                      <p className="text-xs text-muted-foreground">Posts</p>
                    </div>
                    <div className="p-2 bg-muted rounded-lg">
                      <p className="font-semibold">{userStats.badges?.length || 0}</p>
                      <p className="text-xs text-muted-foreground">Badges</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Leaderboard */}
            <Card className="dark:border-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  Top Contributors
                </CardTitle>
              </CardHeader>
              <CardContent>
                {leaderboard.length > 0 ? (
                  <div className="space-y-3">
                    {leaderboard.map((entry, idx) => (
                      <div key={entry.user_id} className="flex items-center gap-3">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                          idx === 0 ? 'bg-yellow-500 text-white' :
                          idx === 1 ? 'bg-gray-400 text-white' :
                          idx === 2 ? 'bg-orange-600 text-white' :
                          'bg-muted'
                        }`}>
                          {entry.rank}
                        </span>
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={entry.user_picture} />
                          <AvatarFallback className="text-xs">
                            {entry.user_name?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{entry.user_name}</p>
                          <p className="text-xs text-muted-foreground">{entry.total_points} pts</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No contributors yet
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="dark:border-white/10">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{posts.length}</span> active discussions
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* New Post Dialog */}
      <NewPostDialog 
        open={showNewPost} 
        onOpenChange={setShowNewPost}
        onSuccess={() => {
          setShowNewPost(false);
          fetchPosts();
          fetchUserStats();
        }}
        location={location}
        token={token}
      />
    </div>
  );
}

function PostCard({ post, onVote, isAuthenticated, token, onRefresh }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const categoryIcon = CATEGORIES.find(c => c.value === post.category)?.icon || MessageSquare;
  const CategoryIcon = categoryIcon;

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const response = await axios.get(`${API_URL}/api/community/posts/${post.post_id}/comments`);
      setComments(response.data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleToggleComments = () => {
    if (!showComments) {
      fetchComments();
    }
    setShowComments(!showComments);
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      await axios.post(
        `${API_URL}/api/community/posts/${post.post_id}/comments`,
        { content: newComment },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewComment('');
      fetchComments();
      toast.success('Comment posted!');
    } catch (error) {
      toast.error('Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className={`dark:border-white/10 ${post.is_pinned ? 'ring-2 ring-primary/50' : ''}`} data-testid={`post-${post.post_id}`}>
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Vote Column */}
          <div className="flex flex-col items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onVote(post.post_id, 'up')}
              disabled={!isAuthenticated}
            >
              <ChevronUp className="h-5 w-5" />
            </Button>
            <span className="text-sm font-semibold">{post.upvotes - post.downvotes}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onVote(post.post_id, 'down')}
              disabled={!isAuthenticated}
            >
              <ChevronDown className="h-5 w-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 mb-2">
              {post.is_pinned && (
                <Badge className="bg-primary/10 text-primary">Pinned</Badge>
              )}
              <Badge variant="outline" className="gap-1">
                <CategoryIcon className="h-3 w-3" />
                {post.category}
              </Badge>
              {post.neighborhood && (
                <Badge variant="secondary" className="gap-1">
                  <MapPin className="h-3 w-3" />
                  {post.neighborhood}
                </Badge>
              )}
            </div>

            <h3 className="font-semibold text-lg mb-2">{post.title}</h3>
            <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
              {post.content}
            </p>

            {/* Tags */}
            {post.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {post.tags.map((tag, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    #{tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={post.author_picture} />
                  <AvatarFallback className="text-xs">{post.author_name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <span>{post.author_name}</span>
                <span>•</span>
                <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleComments}
                className="gap-1"
              >
                <MessageCircle className="h-4 w-4" />
                {post.comment_count}
              </Button>
            </div>

            {/* Comments Section */}
            {showComments && (
              <div className="mt-4 pt-4 border-t border-border">
                {loadingComments ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-3 mb-4">
                      {comments.length > 0 ? comments.map((comment) => (
                        <div key={comment.comment_id} className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={comment.author_picture} />
                            <AvatarFallback className="text-xs">{comment.author_name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium">{comment.author_name}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                              </span>
                            </div>
                            <p className="text-sm">{comment.content}</p>
                          </div>
                        </div>
                      )) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No comments yet. Be the first to reply!
                        </p>
                      )}
                    </div>

                    {isAuthenticated && (
                      <form onSubmit={handleSubmitComment} className="flex gap-2">
                        <Input
                          placeholder="Write a comment..."
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          className="flex-1"
                        />
                        <Button type="submit" disabled={submitting || !newComment.trim()}>
                          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                      </form>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NewPostDialog({ open, onOpenChange, onSuccess, location, token }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('general');
  const [tags, setTags] = useState('');
  const [locationSpecific, setLocationSpecific] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!title.trim() || !content.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const postData = {
        title,
        content,
        category,
        tags: tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean),
        location_specific: locationSpecific,
        latitude: locationSpecific ? location?.latitude : null,
        longitude: locationSpecific ? location?.longitude : null,
      };

      await axios.post(
        `${API_URL}/api/community/posts`,
        postData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Post created! +5 points');
      setTitle('');
      setContent('');
      setCategory('general');
      setTags('');
      setLocationSpecific(false);
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create post');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Start a Discussion</DialogTitle>
          <DialogDescription>
            Share something with your local community
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Title *</label>
            <Input
              placeholder="What's on your mind?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Content *</label>
            <Textarea
              placeholder="Share more details..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tags (comma separated)</label>
            <Input
              placeholder="coffee, remote work, wifi"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="locationSpecific"
              checked={locationSpecific}
              onChange={(e) => setLocationSpecific(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="locationSpecific" className="text-sm">
              Tag my current location
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Post
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
