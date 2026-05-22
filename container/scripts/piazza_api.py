"""Piazza API helper — reads JSON request from stdin, returns JSON to stdout.

Uses the unofficial piazza-api library. Requires PIAZZA_EMAIL and PIAZZA_PASSWORD
environment variables, plus PIAZZA_NETWORK_ID for the course network.
"""
import json
import sys
import os
import re
from datetime import datetime

try:
    from piazza_api import Piazza
except ImportError:
    print(json.dumps({"error": "piazza-api library not installed. Run: pip install piazza-api"}))
    sys.exit(1)

EMAIL = os.environ.get('PIAZZA_EMAIL', '')
PASSWORD = os.environ.get('PIAZZA_PASSWORD', '')
NETWORK_ID = os.environ.get('PIAZZA_NETWORK_ID', '')
MAX_POSTS = 50


def strip_html(html):
    text = re.sub(r'<[^>]+>', ' ', html or '')
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&lt;', '<', text)
    text = re.sub(r'&gt;', '>', text)
    text = re.sub(r'&quot;', '"', text)
    text = re.sub(r'&#39;', "'", text)
    return re.sub(r'\s+', ' ', text).strip()


def format_post_summary(post):
    """Format a post into a concise summary."""
    history = post.get('history', [{}])
    latest = history[0] if history else {}
    subject = latest.get('subject', post.get('subject', 'No subject'))
    content = strip_html(latest.get('content', ''))

    tags = post.get('tags', [])
    post_type = post.get('type', 'unknown')
    nr = post.get('nr', '?')
    created = post.get('created', '')
    num_answers = len(post.get('children', []))
    is_resolved = post.get('no_answer', 0) == 0 and post_type == 'question'

    # Truncate content
    if len(content) > 500:
        content = content[:500] + '...'

    return {
        'id': nr,
        'type': post_type,
        'subject': strip_html(subject),
        'content': content,
        'tags': tags,
        'created': created[:10] if created else '',
        'num_responses': num_answers,
        'resolved': is_resolved,
    }


def format_post_detail(post):
    """Format a post with full content and all answers."""
    history = post.get('history', [{}])
    latest = history[0] if history else {}
    subject = latest.get('subject', post.get('subject', 'No subject'))
    content = strip_html(latest.get('content', ''))

    children = post.get('children', [])
    answers = []
    for child in children:
        child_type = child.get('type', '')
        child_history = child.get('history', [{}])
        child_latest = child_history[0] if child_history else {}
        child_content = strip_html(child_latest.get('content', ''))
        if child_content:
            answers.append({
                'type': child_type,  # 'i_answer' (instructor) or 's_answer' (student)
                'content': child_content[:2000],
                'endorsements': child.get('tag_endorse', []),
                'created': child.get('created', '')[:10],
            })

    followups = []
    for child in children:
        if child.get('type') == 'followup':
            fu_content = strip_html(child.get('subject', ''))
            if fu_content:
                followups.append({
                    'content': fu_content[:500],
                    'replies': len(child.get('children', [])),
                })

    return {
        'id': post.get('nr', '?'),
        'type': post.get('type', 'unknown'),
        'subject': strip_html(subject),
        'content': content[:3000],
        'tags': post.get('tags', []),
        'created': post.get('created', '')[:10],
        'answers': answers,
        'followups': followups[:10],
        'num_views': post.get('unique_views', 0),
        'is_pinned': post.get('pin', False),
    }


def handle(req):
    action = req.get('action', '')
    params = req.get('params', {})

    if not EMAIL or not PASSWORD:
        return {"error": "PIAZZA_EMAIL and PIAZZA_PASSWORD not configured"}
    if not NETWORK_ID:
        return {"error": "PIAZZA_NETWORK_ID not configured"}

    # Connect
    p = Piazza()
    p.user_login(email=EMAIL, password=PASSWORD)
    network = p.network(NETWORK_ID)

    if action == 'recent_posts':
        limit = int(params.get('limit', '20'))
        limit = min(limit, MAX_POSTS)
        posts = list(network.iter_all_posts(limit=limit))
        return {
            "posts": [format_post_summary(post) for post in posts],
            "count": len(posts),
        }

    elif action == 'get_post':
        post_id = params.get('post_id', '')
        if not post_id:
            return {"error": "post_id parameter required"}
        try:
            post = network.get_post(int(post_id))
            return format_post_detail(post)
        except Exception as e:
            return {"error": f"Failed to get post {post_id}: {str(e)}"}

    elif action == 'search':
        query = params.get('query', '')
        if not query:
            return {"error": "query parameter required"}
        results = network.search(query)
        posts = []
        for result in results[:20]:
            try:
                post = network.get_post(result['id'])
                posts.append(format_post_summary(post))
            except Exception:
                continue
        return {"posts": posts, "count": len(posts), "query": query}

    elif action == 'get_pinned':
        # Get pinned/instructor posts
        feed = network.get_feed(limit=100, offset=0)
        pinned = []
        for item in feed.get('feed', []):
            if item.get('pin'):
                try:
                    post = network.get_post(item['nr'])
                    pinned.append(format_post_summary(post))
                except Exception:
                    continue
        return {"posts": pinned, "count": len(pinned)}

    elif action == 'get_by_tag':
        tag = params.get('tag', '')
        if not tag:
            return {"error": "tag parameter required (e.g., 'hw1', 'docker', 'exam')"}
        # Search by tag via feed filtering
        feed = network.get_feed(limit=200, offset=0)
        matching = []
        for item in feed.get('feed', []):
            if tag.lower() in [t.lower() for t in item.get('tags', [])]:
                try:
                    post = network.get_post(item['nr'])
                    matching.append(format_post_summary(post))
                except Exception:
                    continue
                if len(matching) >= MAX_POSTS:
                    break
        return {"posts": matching, "count": len(matching), "tag": tag}

    elif action == 'stats':
        stats = network.get_statistics()
        return {
            "total_posts": stats.get('total', {}).get('questions', 0) + stats.get('total', {}).get('notes', 0),
            "total_questions": stats.get('total', {}).get('questions', 0),
            "total_notes": stats.get('total', {}).get('notes', 0),
            "total_students": stats.get('total', {}).get('students', 0),
        }

    else:
        return {"error": f"Unknown action: {action}. Valid: recent_posts, get_post, search, get_pinned, get_by_tag, stats"}


if __name__ == '__main__':
    try:
        req = json.loads(sys.stdin.read())
    except json.JSONDecodeError:
        print(json.dumps({"error": "Invalid JSON on stdin"}))
        sys.exit(1)

    try:
        result = handle(req)
        print(json.dumps(result, ensure_ascii=False, default=str))
    except Exception as e:
        print(json.dumps({"error": f"Piazza API error: {str(e)}"}))
        sys.exit(1)
