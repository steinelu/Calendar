class SegmentTree:
    def __init__(self, arr):
        self.root = SegmentTreeNode((0, 0))

    def query(self, q):
        return self.root.query(q)


class SegmentTreeNode:
    def __init__(self, range): # leaf
        a, b = sorted(range)
        self.min = a
        self.max = b
        self.left = None
        self.right = None

    def query(self, q):
        # if one is None then the other is also None
        if self.left is None or self.right is None:
            return [self.min, self.max]

        if q >= self.Min and q <= self.max:
            return self.left.query(q) + self.right.query(q)
        else:
            return []

def main():
    ranges = [[1,4], [1, 6], [1, 10],
              [2,3], [2, 7], [2, 8],
              [4,6], [4, 7],
              [5,10], [6, 8], [6, 10], [7,8]]
    


if __name__ == "__main__":
    main()