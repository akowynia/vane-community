import ChatWindow from '@/components/ChatWindow';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chat - Vane-Community',
  description: 'Chat with the internet, chat with Vane-Community.',
};

const Home = () => {
  return <ChatWindow />;
};

export default Home;
