#!/bin/bash
# Every feature, and the edges around it, against a clean instance.
B=http://127.0.0.1:8082
T=/home/eugene/coding/projects/rwthrank/transcript.pdf
LOG=/tmp/pbedge.log
pass=0; fail=0

code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
body() { curl -s "$@"; }

check() { # name expected actual
  if [ "$2" = "$3" ]; then printf "  ok    %-52s %s\n" "$1" "$3"; pass=$((pass+1));
  else printf "  FAIL  %-52s got %s want %s\n" "$1" "$3" "$2"; fail=$((fail+1)); fi
}

otp() { # email [grade] -> token
  local payload="{\"email\":\"$1\""
  [ -n "$2" ] && payload="$payload,\"grade\":$2"
  payload="$payload}"
  local id
  id=$(body -X POST $B/api/collections/users/request-otp -H 'Content-Type: application/json' -d "$payload" | python3 -c 'import sys,json;print(json.load(sys.stdin)["otpId"])')
  sleep 0.3
  local c
  c=$(grep -A1 "DEV OTP" $LOG | tail -1 | python3 -c 'import sys,json;print(json.loads(sys.stdin.read().split("─ ",1)[1])["otp"])')
  body -X POST $B/api/collections/users/auth-with-otp -H 'Content-Type: application/json' -d "{\"otpId\":\"$id\",\"password\":\"$c\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("token",""))'
}

echo "== auth =="
A=$(otp a@example.com 2.0)
check "register with grade returns a token" "yes" "$([ -n "$A" ] && echo yes || echo no)"
check "rank reflects the typed grade" "2" "$(body $B/api/rank -H "Authorization: $A" | python3 -c 'import sys,json;print(json.load(sys.stdin)["grade"])')"
check "signed-in user registering again is accepted" "200" "$(code -X POST $B/api/collections/users/request-otp -H 'Content-Type: application/json' -d '{"email":"a@example.com","grade":1.7}')"
check "  and the grade is replaced, not stacked" "1" "$(body $B/api/collections/transcripts/records -H "Authorization: $A" | python3 -c 'import sys,json;print(json.load(sys.stdin)["totalItems"])')"
check "grade above the scale is refused" "400" "$(code -X POST $B/api/grade -H "Authorization: $A" -H 'Content-Type: application/json' -d '{"grade":7}')"
check "grade below the scale is refused" "400" "$(code -X POST $B/api/grade -H "Authorization: $A" -H 'Content-Type: application/json' -d '{"grade":0.5}')"
check "unknown email still answers 200 (no enumeration)" "200" "$(code -X POST $B/api/collections/users/request-otp -H 'Content-Type: application/json' -d '{"email":"nobody@example.com"}')"
check "a used OTP cannot be reused" "400" "$(code -X POST $B/api/collections/users/auth-with-otp -H 'Content-Type: application/json' -d '{"otpId":"deadbeefdeadbee","password":"12345678"}')"
check "no token means no rank" "401" "$(code $B/api/rank)"

echo "== transcripts =="
check "first upload succeeds" "200" "$(code -X POST $B/api/transcript -H "Authorization: $A" -F file=@$T)"
check "same field of study asks first" "409" "$(code -X POST $B/api/transcript -H "Authorization: $A" -F file=@$T)"
check "confirmed replace succeeds" "200" "$(code -X POST "$B/api/transcript?replace=1" -H "Authorization: $A" -F file=@$T)"
check "  still one uploaded transcript" "1" "$(body "$B/api/collections/transcripts/records?filter=$(python3 -c "import urllib.parse;print(urllib.parse.quote('pdf!=\"\"'))")" -H "Authorization: $A" | python3 -c 'import sys,json;print(json.load(sys.stdin)["totalItems"])')"
check "  modules stored once" "23" "$(body "$B/api/collections/results/records?perPage=1" -H "Authorization: $A" | python3 -c 'import sys,json;print(json.load(sys.stdin)["totalItems"])')"
echo "not a pdf" > /tmp/notapdf.pdf
check "a non-PDF is refused" "400" "$(code -X POST $B/api/transcript -H "Authorization: $A" -F file=@/tmp/notapdf.pdf)"
check "a missing file field is refused" "400" "$(code -X POST $B/api/transcript -H "Authorization: $A" -F wrong=@$T)"
check "upload without a token is refused" "401" "$(code -X POST $B/api/transcript -F file=@$T)"

echo "== isolation between accounts =="
C=$(otp c@example.com 3.0)
check "B sees none of A's transcripts" "0" "$(body "$B/api/collections/transcripts/records?filter=$(python3 -c "import urllib.parse;print(urllib.parse.quote('pdf!=\"\"'))")" -H "Authorization: $C" | python3 -c 'import sys,json;print(json.load(sys.stdin)["totalItems"])')"
check "B sees none of A's results" "0" "$(body $B/api/collections/results/records -H "Authorization: $C" | python3 -c 'import sys,json;print(json.load(sys.stdin)["totalItems"])')"
TID=$(body "$B/api/collections/transcripts/records?filter=$(python3 -c "import urllib.parse;print(urllib.parse.quote('pdf!=\"\"'))")" -H "Authorization: $A" | python3 -c 'import sys,json;print(json.load(sys.stdin)["items"][0]["id"])')
check "B cannot delete A's transcript" "404" "$(code -X DELETE $B/api/collections/transcripts/records/$TID -H "Authorization: $C")"
check "B cannot rename A's field of study" "404" "$(code -X POST $B/api/transcript/$TID/subject -H "Authorization: $C" -H 'Content-Type: application/json' -d '{"program":"Medizin","degree":"Master"}')"
check "nobody can write a transcript directly" "403" "$(code -X POST $B/api/collections/transcripts/records -H "Authorization: $A" -H 'Content-Type: application/json' -d '{"user":"x"}')"
check "nobody can write a result directly" "403" "$(code -X POST $B/api/collections/results/records -H "Authorization: $A" -H 'Content-Type: application/json' -d '{"user":"x"}')"
check "nobody can invent a course" "403" "$(code -X POST $B/api/collections/courses/records -H "Authorization: $A" -H 'Content-Type: application/json' -d '{"name":"Fake"}')"

echo "== subject and ranking =="
PID=$(body $B/api/collections/transcripts/records -H "Authorization: $A" | python3 -c '
import sys,json
for t in json.load(sys.stdin)["items"]:
    if not t["pdf"]: print(t["id"]); break')
check "an invented field of study is refused" "400" "$(code -X POST $B/api/transcript/$PID/subject -H "Authorization: $A" -H 'Content-Type: application/json' -d '{"program":"Jura","degree":"Bachelor"}')"
check "an invented degree is refused" "400" "$(code -X POST $B/api/transcript/$PID/subject -H "Authorization: $A" -H 'Content-Type: application/json' -d '{"program":"Informatik","degree":"Diplom"}')"
check "a real one is accepted" "200" "$(code -X POST $B/api/transcript/$PID/subject -H "Authorization: $A" -H 'Content-Type: application/json' -d '{"program":"Informatik","degree":"Bachelor"}')"
check "unknown course id is not found" "404" "$(code $B/api/rank/course/doesnotexist -H "Authorization: $A")"

echo "== compare =="
check "unfiltered reports the printed grade" "True" "$(body -X POST $B/api/compare -H "Authorization: $A" -H 'Content-Type: application/json' -d '{"studySemester":-1}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["official"])')"
check "  and it equals the transcript" "1.6" "$(body -X POST $B/api/compare -H "Authorization: $A" -H 'Content-Type: application/json' -d '{"studySemester":-1}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["average"])')"
check "a narrowed one is marked computed" "False" "$(body -X POST $B/api/compare -H "Authorization: $A" -H 'Content-Type: application/json' -d '{"studySemester":-1,"semesters":["24S"]}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["official"])')"
check "a semester with nothing in it is empty, not an error" "None" "$(body -X POST $B/api/compare -H "Authorization: $A" -H 'Content-Type: application/json' -d '{"studySemester":-1,"semesters":["99W"]}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["average"])')"
check "median is reported" "yes" "$(body -X POST $B/api/compare -H "Authorization: $A" -H 'Content-Type: application/json' -d '{"studySemester":-1}' | python3 -c 'import sys,json;print("yes" if json.load(sys.stdin)["cohortMedian"] is not None else "no")')"
check "compare needs a token" "401" "$(code -X POST $B/api/compare -H 'Content-Type: application/json' -d '{}')"

echo "== deletion =="
DEL=$(otp del@example.com 2.0)
curl -s -X POST $B/api/transcript -H "Authorization: $DEL" -F file=@$T >/dev/null
ACCT=$(body $B/api/collections/users/auth-refresh -X POST -H "Authorization: $DEL" | python3 -c 'import sys,json;print(json.load(sys.stdin)["record"]["id"])')
check "self-delete succeeds" "204" "$(code -X DELETE $B/api/collections/users/records/$ACCT -H "Authorization: $DEL")"
check "  their transcripts are gone" "0" "$(body "$B/api/collections/transcripts/records" -H "Authorization: $DEL" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("totalItems",0))' 2>/dev/null || echo 0)"
check "a token for a deleted account stops working" "401" "$(code $B/api/rank -H "Authorization: $DEL")"

echo
echo "  passed $pass, failed $fail"
