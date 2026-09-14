#!/usr/bin/env python3
"""Reconcile active restart aliases from the verified publication ledger.

This does not approve, publish, mark new URLs complete, or remove medical holds.
"""
import argparse, copy, json
from pathlib import Path

def read(p): return json.loads(Path(p).read_text())
def write(p, d):
    p = Path(p); p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(p.suffix + '.tmp')
    tmp.write_text(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
    tmp.replace(p)

def validate_current(c):
    rows, accepted, counts = c['completion_rows'], c['accepted_paths'], c['counts']
    completed = {r['path'] for r in rows if r.get('latest_standard_completed')}
    assert len(rows) == len({r['path'] for r in rows}) == counts['total_scope'] == 156
    assert completed == set(accepted) and len(accepted) == len(set(accepted))
    assert len(completed) == counts['latest_standard_published_confirmed']
    assert counts['latest_standard_not_confirmed_or_remaining'] == 156 - len(completed)
    assert c['public_commit'] == c['latest_release']['final_head']
    assert c['latest_validation']['public_status'] == 'PASS'
    assert c['next'] and c['latest_validation']['run']

def reconcile(c, s, p):
    validate_current(c)
    s, p = copy.deepcopy(s), copy.deepcopy(p)
    run, head, nxt = c['latest_validation']['run'], c['public_commit'], c['next'][0]
    counts = c['counts']
    for doc in [s, p]:
        doc['counts'] = copy.deepcopy(counts)
        doc['current_completion_counts'] = copy.deepcopy(counts)
        doc['latest_repository_commit'] = head
        doc['latest_local_run'] = run
        doc['current_completion_ledger'] = 'background_resume/' + run + '/completion_ledger.json'
        doc['next_priority'] = nxt
        for key in ['business_objective', 'recommendation_first', 'user_efficiency_and_recommendation_rules']:
            if key in doc: doc[key]['next_priority'] = nxt
        pending = doc.get('latest_pending_run')
        if pending:
            paths = [x for x in pending.get('candidate_files', {}) if not Path(x).name.startswith('index')]
            if paths and set(paths) <= set(c['accepted_paths']):
                doc.setdefault('resolved_history', []).append({'record': doc.pop('latest_pending_run'), 'resolution': 'Superseded by verified ledger entries; retained as history.'})
    s['next_steps'] = c['next']
    s['state'] = 'IN_PROGRESS_LATEST_STANDARD_VERIFIED_' + str(len(c['accepted_paths']))
    s['this_thread_scope'] = 'Continue existing sitemap URLs from the verified current ledger.'
    s['latest_local_cleanup'] = {'run': run, 'status': 'PUBLISHED_PUBLIC_VERIFIED', 'receipt': run + '/release_receipt.json'}
    s['latest_commit_scope_verification'] = c['latest_release']['compare']
    s['latest_public_release'] = {'run': run, 'commit': head, 'public_verified': True, 'paths': [url.removeprefix('https://wiki.body-all.co.kr/') for url in c['latest_validation']['article_urls']]}
    for doc in [s, p]:
        doc['restart_guard'] = {'version': 1, 'canonical': 'GitHub recovery/html-20260914:ops/html-recovery/current.json', 'check': 'python resume_guard.py --current <current.json> --state <continuation_state.json> --policy <topic_review_policy.json>', 'rule': 'Validate before choosing the next URL or reporting counts; retain document-specific holds.'}
    return s, p

def validate_aliases(c, s, p):
    validate_current(c)
    for doc in [s, p]:
        assert doc['counts'] == doc['current_completion_counts'] == c['counts'], 'count_alias_conflict'
        assert doc['latest_repository_commit'] == c['public_commit'], 'commit_alias_conflict'
        assert doc['latest_local_run'] == c['latest_validation']['run'], 'run_alias_conflict'
        assert doc['next_priority'] == c['next'][0], 'priority_alias_conflict'
        for key in ['business_objective', 'recommendation_first', 'user_efficiency_and_recommendation_rules']:
            if key in doc: assert doc[key]['next_priority'] == c['next'][0], key + '_priority_conflict'
        pending = doc.get('latest_pending_run')
        if pending:
            paths = [x for x in pending.get('candidate_files', {}) if not Path(x).name.startswith('index')]
            assert not (paths and set(paths) <= set(c['accepted_paths'])), 'completed_run_still_pending'

if __name__ == '__main__':
    ap=argparse.ArgumentParser(); ap.add_argument('--current',required=True); ap.add_argument('--state',required=True); ap.add_argument('--policy',required=True); ap.add_argument('--repair',action='store_true'); ap.add_argument('--archive-dir')
    args=ap.parse_args(); c,s,p=map(read,[args.current,args.state,args.policy])
    if args.repair:
        assert args.archive_dir, 'archive required for repair'
        for src in [args.state,args.policy]:
            dest=Path(args.archive_dir)/Path(src).name
            if not dest.exists(): write(dest,read(src))
        s,p=reconcile(c,s,p); validate_aliases(c,s,p)
        write(args.state,s); write(args.policy,p)
    validate_aliases(c,s,p)
    print(json.dumps({'status':'PASS','completed':len(c['accepted_paths']),'remaining':156-len(c['accepted_paths']),'public_commit':c['public_commit'],'next':c['next'][0]},ensure_ascii=False))
