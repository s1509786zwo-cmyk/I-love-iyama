using System.Collections;
using UnityEngine;

namespace MimiHorror.Interaction
{
    /// <summary>
    /// 物理演算なしで開閉するドア。襖・障子（スライド）と洋風ドア（回転）の両対応。
    /// 使い方：Interactable の On Interact に、このコンポーネントの Toggle() を登録するだけ。
    /// アニメーション中だけコルーチンが回り、普段はコストゼロ。
    /// </summary>
    public class SimpleDoor : MonoBehaviour
    {
        public enum DoorType
        {
            Slide,  // 襖・障子・引き戸
            Swing   // 蝶番で開くドア（ヒンジとなる空オブジェクトに付けること）
        }

        [SerializeField] private DoorType doorType = DoorType.Slide;

        [Tooltip("動かす対象。未設定なら自分自身")]
        [SerializeField] private Transform movingPart;

        [Header("スライド設定（襖・障子）")]
        [Tooltip("ローカル座標でどれだけずらすか。例：横に 0.9m なら (0.9, 0, 0)")]
        [SerializeField] private Vector3 slideOffset = new Vector3(0.9f, 0f, 0f);

        [Header("回転設定（洋風ドア）")]
        [SerializeField] private float swingAngleY = 95f;

        [Header("共通")]
        [SerializeField] private float duration = 0.8f;
        [SerializeField] private bool startOpen = false;
        [SerializeField] private AudioSource audioSource;
        [SerializeField] private AudioClip moveClip;

        private Vector3 _closedLocalPosition;
        private Quaternion _closedLocalRotation;
        private bool _isOpen;
        private Coroutine _routine;

        public bool IsOpen => _isOpen;

        private void Awake()
        {
            if (movingPart == null)
            {
                movingPart = transform;
            }

            _closedLocalPosition = movingPart.localPosition;
            _closedLocalRotation = movingPart.localRotation;
            _isOpen = startOpen;

            if (startOpen)
            {
                ApplyPose(1f);
            }
        }

        /// <summary>Interactable の On Interact から呼ぶ</summary>
        public void Toggle()
        {
            SetOpen(!_isOpen);
        }

        public void SetOpen(bool open)
        {
            _isOpen = open;

            if (audioSource != null && moveClip != null)
            {
                audioSource.PlayOneShot(moveClip);
            }

            if (_routine != null)
            {
                StopCoroutine(_routine);
            }
            _routine = StartCoroutine(AnimateRoutine(open ? 1f : 0f));
        }

        private IEnumerator AnimateRoutine(float target01)
        {
            float start01 = Current01();
            float elapsed = 0f;
            float total = Mathf.Max(0.01f, duration * Mathf.Abs(target01 - start01));

            while (elapsed < total)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / total);
                float eased = t * t * (3f - 2f * t); // SmoothStep
                ApplyPose(Mathf.Lerp(start01, target01, eased));
                yield return null;
            }

            ApplyPose(target01);
            _routine = null;
        }

        private float Current01()
        {
            if (doorType == DoorType.Slide)
            {
                if (slideOffset.sqrMagnitude < 0.0001f) return 0f;
                Vector3 moved = movingPart.localPosition - _closedLocalPosition;
                return Mathf.Clamp01(Vector3.Dot(moved, slideOffset) / slideOffset.sqrMagnitude);
            }

            float angle = Quaternion.Angle(_closedLocalRotation, movingPart.localRotation);
            return Mathf.Clamp01(angle / Mathf.Max(1f, Mathf.Abs(swingAngleY)));
        }

        private void ApplyPose(float open01)
        {
            if (doorType == DoorType.Slide)
            {
                movingPart.localPosition = _closedLocalPosition + slideOffset * open01;
            }
            else
            {
                movingPart.localRotation = _closedLocalRotation * Quaternion.Euler(0f, swingAngleY * open01, 0f);
            }
        }
    }
}
